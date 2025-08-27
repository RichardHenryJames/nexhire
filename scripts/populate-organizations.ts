import { dbService } from '../src/services/database.service';

// Use global fetch provided by Node 18+; declare to avoid DOM typings requirement
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const fetch: any;

interface WikidataOrg {
  name: string;
  website?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  establishedDate?: string | null; // ISO
}

async function fetchFromWikidata(limit = 500, offset = 0): Promise<WikidataOrg[]> {
  const endpoint = 'https://query.wikidata.org/sparql';
  const query = `
    SELECT ?company ?companyLabel ?website ?industryLabel ?hqLabel ?inception WHERE {
      ?company wdt:P31 wd:Q4830453 .
      OPTIONAL { ?company wdt:P856 ?website . }
      OPTIONAL { ?company wdt:P452 ?industry . }
      OPTIONAL { ?company wdt:P159 ?hq . }
      OPTIONAL { ?company wdt:P571 ?inception . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'NexHire/1.0 (populate-organizations script)'
    }
  });

  if (!res || !res.ok) {
    throw new Error(`Wikidata request failed: ${res?.status} ${res?.statusText}`);
  }

  const data = await res.json();
  const bindings: any[] = data?.results?.bindings || [];
  const mapped: WikidataOrg[] = bindings
    .map(b => ({
      name: b.companyLabel?.value,
      website: b.website?.value || null,
      industry: b.industryLabel?.value || null,
      headquarters: b.hqLabel?.value || null,
      establishedDate: b.inception?.value || null
    }))
    .filter(o => !!o.name);

  return mapped;
}

async function upsertOrganization(org: WikidataOrg): Promise<'inserted' | 'updated' | 'skipped'> {
  // Prepared default values compatible with schema
  const type = 'Company';
  const size = 'Unknown';
  const linkedIn: string | null = null;
  const description: string | null = null;
  const logoURL: string | null = null;
  const verificationStatus = 0; // Pending
  const verifiedAt: string | null = null;
  const verifiedBy: string | null = null;
  const contactEmail: string | null = null;
  const contactPhone: string | null = null;
  const rating: number | null = null;
  const createdBy: string | null = null;
  const updatedBy: string | null = null;
  const isActive = 1;

  let establishedDate: string | null = null;
  if (org.establishedDate) {
    try {
      const d = new Date(org.establishedDate);
      if (!isNaN(d.getTime())) {
        establishedDate = d.toISOString().substring(0, 10); // YYYY-MM-DD
      }
    } catch {
      // ignore parse errors
    }
  }

  // Upsert by UNIQUE Name
  const existsQuery = `
    SELECT TOP 1 OrganizationID, Name FROM Organizations 
    WHERE Name = @param0
  `;
  const exists = await dbService.executeQuery(existsQuery, [org.name]);
  if (exists.recordset && exists.recordset.length > 0) {
    // Update existing basic fields if any are null
    const updateQuery = `
      UPDATE Organizations SET 
        Type = COALESCE(Type, @param0),
        Industry = COALESCE(Industry, @param1),
        Size = COALESCE(Size, @param2),
        Website = COALESCE(Website, @param3),
        LinkedInProfile = COALESCE(LinkedInProfile, @param4),
        Description = COALESCE(Description, @param5),
        LogoURL = COALESCE(LogoURL, @param6),
        EstablishedDate = COALESCE(EstablishedDate, @param7),
        Headquarters = COALESCE(Headquarters, @param8),
        ContactEmail = COALESCE(ContactEmail, @param9),
        ContactPhone = COALESCE(ContactPhone, @param10),
        UpdatedAt = GETUTCDATE()
      WHERE Name = @param11
    `;
    await dbService.executeQuery(updateQuery, [
      type,
      org.industry || null,
      size,
      org.website || null,
      linkedIn,
      description,
      logoURL,
      establishedDate,
      org.headquarters || null,
      contactEmail,
      contactPhone,
      org.name
    ]);
    return 'updated';
  } else {
    // Insert without OrganizationID (INT IDENTITY)
    const insertQuery = `
      INSERT INTO Organizations (
        Name, Type, Industry, Size, Website, LinkedInProfile, Description, LogoURL,
        VerificationStatus, VerifiedAt, VerifiedBy, EstablishedDate, Headquarters, ContactEmail, ContactPhone,
        Rating, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsActive
      ) VALUES (
        @param0, @param1, @param2, @param3, @param4, @param5, @param6, @param7,
        @param8, @param9, @param10, @param11, @param12, @param13, @param14,
        @param15, GETUTCDATE(), GETUTCDATE(), @param16, @param17, @param18
      )
    `;

    await dbService.executeQuery(insertQuery, [
      org.name,
      type,
      org.industry || null,
      size,
      org.website || null,
      linkedIn,
      description,
      logoURL,
      verificationStatus,
      verifiedAt,
      verifiedBy,
      establishedDate,
      org.headquarters || null,
      contactEmail,
      contactPhone,
      rating,
      createdBy,
      updatedBy,
      isActive
    ]);

    return 'inserted';
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const batch = Number(process.env.BATCH || '500');
  const maxBatches = process.env.MAX_BATCHES ? Number(process.env.MAX_BATCHES) : undefined; // optional hard cap
  let offset = Number(process.env.OFFSET || '0');

  console.log(`Starting organizations population: batch=${batch}, offset=${offset}${maxBatches ? `, maxBatches=${maxBatches}` : ''}`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let batchCount = 0;

  while (true) {
    if (maxBatches !== undefined && batchCount >= maxBatches) {
      console.log(`Reached maxBatches=${maxBatches}. Stopping.`);
      break;
    }

    console.log(`Fetching Wikidata batch: limit=${batch}, offset=${offset} ...`);
    const orgs = await fetchFromWikidata(batch, offset);
    console.log(`Fetched ${orgs.length} organizations in this batch.`);

    if (orgs.length === 0) {
      console.log('No more organizations returned by Wikidata. Done.');
      break;
    }

    for (const org of orgs) {
      try {
        const result = await upsertOrganization(org);
        if (result === 'inserted') totalInserted++; else if (result === 'updated') totalUpdated++;
      } catch (err) {
        console.warn(`Failed to upsert org '${org.name}':`, (err as Error).message);
      }
    }

    batchCount++;
    offset += batch;

    // Polite delay to avoid rate limiting
    await sleep(1000);
  }

  console.log(`All done. Inserted: ${totalInserted}, Updated: ${totalUpdated}`);
  await dbService.close();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Populate organizations failed:', err);
    process.exit(1);
  });
}

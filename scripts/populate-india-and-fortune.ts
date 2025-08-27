import { upsertOrganization, WikidataOrg, sleep } from './orgs-shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const fetch: any;

async function fetchWikidataCompaniesByCountry(countryQid: string, limit = 500, offset = 0): Promise<WikidataOrg[]> {
  const endpoint = 'https://query.wikidata.org/sparql';
  const query = `
    SELECT ?company ?companyLabel ?website ?industryLabel ?hqLabel ?inception WHERE {
      ?company wdt:P31 wd:Q4830453 .                # instance of: company
      ?company wdt:P17 wd:${countryQid} .           # country: India
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
      'User-Agent': 'NexHire/1.0 (populate-india-and-fortune script)'
    }
  });
  if (!res || !res.ok) throw new Error(`Wikidata request failed: ${res?.status} ${res?.statusText}`);
  const data = await res.json();
  const bindings: any[] = data?.results?.bindings || [];
  return bindings.map(b => ({
    name: b.companyLabel?.value,
    website: b.website?.value || null,
    industry: b.industryLabel?.value || null,
    headquarters: b.hqLabel?.value || null,
    establishedDate: b.inception?.value || null
  })).filter((o: WikidataOrg) => !!o.name);
}

async function fetchWikidataFortuneGlobal(limit = 500, offset = 0): Promise<WikidataOrg[]> {
  const endpoint = 'https://query.wikidata.org/sparql';
  // Fortune Global 500 (Q491993) or Fortune 500 (Q81965)
  const query = `
    SELECT ?company ?companyLabel ?website ?industryLabel ?hqLabel ?inception WHERE {
      ?company wdt:P31 wd:Q4830453 .
      ?company p:P166 ?awardStmt .      # award received
      ?awardStmt ps:P166 ?award .
      VALUES ?award { wd:Q491993 wd:Q81965 }  # Fortune Global 500 or Fortune 500
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
      'User-Agent': 'NexHire/1.0 (populate-india-and-fortune script)'
    }
  });
  if (!res || !res.ok) throw new Error(`Wikidata request failed: ${res?.status} ${res?.statusText}`);
  const data = await res.json();
  const bindings: any[] = data?.results?.bindings || [];
  return bindings.map(b => ({
    name: b.companyLabel?.value,
    website: b.website?.value || null,
    industry: b.industryLabel?.value || null,
    headquarters: b.hqLabel?.value || null,
    establishedDate: b.inception?.value || null
  })).filter((o: WikidataOrg) => !!o.name);
}

async function populateIndianCompanies() {
  const countryQid = 'Q668'; // India
  const batch = Number(process.env.BATCH || '500');
  let offset = Number(process.env.OFFSET_IN || '0');

  let inserted = 0, updated = 0;
  while (true) {
    const orgs = await fetchWikidataCompaniesByCountry(countryQid, batch, offset);
    if (orgs.length === 0) break;
    for (const org of orgs) {
      try {
        const result = await upsertOrganization(org);
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++;
      } catch (e) { /* ignore per-company errors */ }
    }
    offset += batch;
    await sleep(1000);
  }
  console.log(`India companies done. Inserted=${inserted}, Updated=${updated}`);
}

async function populateFortuneCompanies() {
  const batch = Number(process.env.BATCH || '500');
  let offset = Number(process.env.OFFSET_FORTUNE || '0');

  let inserted = 0, updated = 0;
  while (true) {
    const orgs = await fetchWikidataFortuneGlobal(batch, offset);
    if (orgs.length === 0) break;
    for (const org of orgs) {
      try {
        const result = await upsertOrganization(org);
        if (result === 'inserted') inserted++; else if (result === 'updated') updated++;
      } catch (e) { /* ignore per-company errors */ }
    }
    offset += batch;
    await sleep(1000);
  }
  console.log(`Fortune companies done. Inserted=${inserted}, Updated=${updated}`);
}

async function main() {
  const mode = (process.env.MODE || 'all').toLowerCase();
  if (mode === 'india') {
    await populateIndianCompanies();
  } else if (mode === 'fortune') {
    await populateFortuneCompanies();
  } else {
    await populateIndianCompanies();
    await populateFortuneCompanies();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('populate-india-and-fortune failed:', err);
    process.exit(1);
  });
}

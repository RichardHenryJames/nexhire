import { dbService } from '../src/services/database.service';

export interface WikidataOrg {
  name: string;
  website?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  establishedDate?: string | null; // ISO
}

export async function upsertOrganization(org: WikidataOrg): Promise<'inserted' | 'updated' | 'skipped'> {
  // Prepared default values compatible with current schema
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

  if (!org.name) return 'skipped';

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
      null,
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

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

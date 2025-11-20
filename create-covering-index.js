const sql = require('mssql');

const config = {
    server: 'refopen-sqlserver-ci.database.windows.net',
    database: 'refopen-sql-db',
    user: 'sqladmin',
    password: 'RefOpen@2024!Secure',
    options: {
        encrypt: true,
     trustServerCertificate: false,
 requestTimeout: 60000
    }
};

async function createCoveringIndex() {
    try {
        await sql.connect(config);
        console.log('? Connected to database\n');

        // Create covering index for getJobs query
        console.log('?? Creating covering index for getJobs performance...\n');

      const indexSQL = `
-- Drop old index if exists
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_GetJobs_Covering' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    DROP INDEX IX_Jobs_GetJobs_Covering ON Jobs;
    PRINT '  Dropped existing index';
END

-- Create optimized covering index
CREATE NONCLUSTERED INDEX IX_Jobs_GetJobs_Covering
ON Jobs (Status, OrganizationID, PublishedAt DESC, CreatedAt DESC, JobID)
INCLUDE (
    Title, Description, Location, City, Country, State, PostalCode,
    JobTypeID, WorkplaceTypeID, Department, IsRemote,
    SalaryRangeMin, SalaryRangeMax, CurrencyID, SalaryPeriod,
    ExperienceMin, ExperienceMax, Tags,
    PostedByUserID, PostedByType, CurrentApplications,
    UpdatedAt
)
WITH (ONLINE = ON, MAXDOP = 4);

PRINT '? Created covering index IX_Jobs_GetJobs_Covering';
`;

 await sql.query(indexSQL);
        console.log('? Index created successfully\n');

      // Test performance improvement
    console.log('?? Testing performance improvement...\n');
        
        const userId = 'E6C8EE05-8317-4853-8D55-852C7D059109';
        const pageSize = 30;

        let t = Date.now();
        const result = await new sql.Request()
            .input('user', sql.VarChar, userId)
        .query(`
    SELECT TOP (${pageSize})
          j.*,
           jt.Type as JobTypeName,
          o.Name as OrganizationName,
      ISNULL(o.LogoURL, '') as OrganizationLogo,
    ISNULL(o.LinkedInProfile, '') as OrganizationLinkedIn,
           ISNULL(o.Website, '') as OrganizationWebsite,
    ISNULL(c.Symbol, '$') as CurrencySymbol,
               CASE
     WHEN j.PostedByUserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName
        WHEN j.PostedByType = 0 THEN 'RefOpen Job Board'
         ELSE 'External Recruiter'
       END as PostedByName
 FROM Jobs j WITH (INDEX(IX_Jobs_GetJobs_Covering))
          INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
     INNER JOIN JobTypes jt ON j.JobTypeID = jt.JobTypeID
 LEFT JOIN Currencies c ON j.CurrencyID = c.CurrencyID
     LEFT JOIN Users u ON j.PostedByUserID = u.UserID
                WHERE j.Status = 'Published' 
          AND o.IsActive = 1
         AND NOT EXISTS (
      SELECT 1 FROM JobApplications ja
    INNER JOIN Applicants a ON ja.ApplicantID = a.ApplicantID
                WHERE a.UserID = @user 
   AND ja.StatusID != 6
        AND ja.JobID = j.JobID
       )
  ORDER BY COALESCE(j.PublishedAt, j.CreatedAt) DESC, j.JobID DESC
    OPTION (RECOMPILE, MAXDOP 4)`);
        
        const queryTime = Date.now() - t;
        
        console.log('Results:');
      console.log(`Rows returned: ${result.recordset.length}`);
    console.log(`  Query time: ${queryTime}ms`);
console.log(`  Status: ${queryTime < 1500 ? '? EXCELLENT' : queryTime < 2000 ? '? GOOD' : '?? NEEDS WORK'}\n`);

        // Show index size
        const indexStats = await sql.query`
            SELECT 
      i.name as IndexName,
              CAST(SUM(s.used_page_count) * 8 / 1024.0 AS DECIMAL(10,2)) as SizeMB,
                SUM(s.row_count) as RowCount
    FROM sys.dm_db_partition_stats s
       INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
    WHERE i.object_id = OBJECT_ID('Jobs')
      AND i.name = 'IX_Jobs_GetJobs_Covering'
     GROUP BY i.name`;
   
        if (indexStats.recordset.length > 0) {
            console.log('Index Statistics:');
      console.log(`  Size: ${indexStats.recordset[0].SizeMB} MB`);
  console.log(`  Rows: ${indexStats.recordset[0].RowCount}`);
        }

        await sql.close();
    console.log('\n? Optimization complete!');

    } catch (err) {
        console.error('? Error:', err.message);
   console.error(err);
 }
}

createCoveringIndex();

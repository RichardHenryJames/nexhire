import { dbService } from './database.service';

export class ServiceInterestService {
  /**
   * Submit user interest in a service
   */
  static async submitInterest(userId: string, serviceName: string): Promise<{ success: boolean; alreadyExists: boolean }> {
    // Check if already exists
    const existing = await dbService.executeQuery(
      `SELECT InterestID FROM ServiceInterests WHERE UserID = @param0 AND ServiceName = @param1`,
      [userId, serviceName]
    );

    if (existing.recordset.length > 0) {
      return { success: true, alreadyExists: true };
    }

    await dbService.executeQuery(
      `INSERT INTO ServiceInterests (UserID, ServiceName) VALUES (@param0, @param1)`,
      [userId, serviceName]
    );

    return { success: true, alreadyExists: false };
  }

  /**
   * Get all services a user has expressed interest in
   */
  static async getUserInterests(userId: string): Promise<string[]> {
    const result = await dbService.executeQuery(
      `SELECT ServiceName FROM ServiceInterests WHERE UserID = @param0 ORDER BY CreatedAt DESC`,
      [userId]
    );

    return result.recordset.map((r: any) => r.ServiceName);
  }

  /**
   * Get interest counts per service (for admin analytics)
   */
  static async getInterestCounts(): Promise<Array<{ serviceName: string; count: number }>> {
    const result = await dbService.executeQuery(`
      SELECT ServiceName, COUNT(*) as InterestCount
      FROM ServiceInterests
      GROUP BY ServiceName
      ORDER BY InterestCount DESC
    `);

    return result.recordset.map((r: any) => ({
      serviceName: r.ServiceName,
      count: r.InterestCount,
    }));
  }
}

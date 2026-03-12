/**
 * Reference Data Repository — Cached access to all lookup/reference tables.
 *
 * WHY THIS EXISTS:
 *  - Organizations, currencies, industries, countries, referral plans, salary components
 *    are small, rarely-changing tables that were queried on EVERY request.
 *  - PricingService had its own ad-hoc cache; nothing else was cached.
 *  - This provides a single, consistent caching layer for all reference data.
 *
 * CACHE STRATEGY:
 *  - Lookup tables (currencies, salary components, referral plans): 30-minute TTL
 *  - Reference metadata (job roles, skills, certifications): 10-minute TTL
 *  - Organizations: 10-minute TTL (larger dataset, ~5k rows)
 *  - Search results: NOT cached (user-specific)
 */

import { dbService } from '../services/database.service';
import { TTLCache, createCache } from '../utils/cache';

// ── Cache instances (module-level singletons) ───────────────────

const lookupCache = createCache<any>(30 * 60 * 1000);     // 30 min
const refMetadataCache = createCache<any>(10 * 60 * 1000); // 10 min
const orgCache = createCache<any>(10 * 60 * 1000);         // 10 min

// ── Repository ──────────────────────────────────────────────────

export class ReferenceRepository {

    // ── Currencies ──────────────────────────────────────────────

    static async getCurrencies(): Promise<any[]> {
        return lookupCache.getOrFetch('currencies', async () => {
            const result = await dbService.executeQuery(
                'SELECT CurrencyID, Code, Name, Symbol, IsActive FROM Currencies WHERE IsActive = 1 ORDER BY Code'
            );
            return result.recordset || [];
        });
    }

    // ── Salary Components ───────────────────────────────────────

    static async getSalaryComponents(): Promise<any[]> {
        return lookupCache.getOrFetch('salary-components', async () => {
            const result = await dbService.executeQuery(
                'SELECT ComponentID, ComponentName, ComponentType, IsActive FROM SalaryComponents WHERE IsActive = 1 ORDER BY ComponentID'
            );
            return result.recordset || [];
        });
    }

    // ── Referral Plans ──────────────────────────────────────────

    static async getReferralPlans(): Promise<any[]> {
        return lookupCache.getOrFetch('referral-plans', async () => {
            const result = await dbService.executeQuery(
                'SELECT PlanID, Name, ReferralsPerDay, DurationDays, Price, CreatedAt FROM ReferralPlans ORDER BY Price ASC'
            );
            return result.recordset || [];
        });
    }

    // ── Countries ───────────────────────────────────────────────

    static async getCountries(): Promise<any[]> {
        return lookupCache.getOrFetch('countries', async () => {
            const result = await dbService.executeQuery(
                'SELECT CountryID, Name, Code, PhoneCode FROM Countries WHERE IsActive = 1 ORDER BY Name'
            );
            return result.recordset || [];
        });
    }

    // ── Industries ──────────────────────────────────────────────

    static async getIndustries(): Promise<any[]> {
        return lookupCache.getOrFetch('industries', async () => {
            const result = await dbService.executeQuery(
                `SELECT DISTINCT Industry FROM Organizations WHERE Industry IS NOT NULL AND Industry != '' AND IsActive = 1 ORDER BY Industry`
            );
            return (result.recordset || []).map((r: any) => r.Industry);
        });
    }

    // ── Reference Metadata (JobRole, Skill, Certification, etc.) ─

    /**
     * Get reference metadata by type — cached per type+category combo
     */
    static async getReferenceByType(refType: string, category?: string): Promise<any[]> {
        const cacheKey = `ref:${refType}:${category || '__all__'}`;
        return refMetadataCache.getOrFetch(cacheKey, async () => {
            let query = `
                SELECT ReferenceID, RefType, Value, Category, Description, IsActive, CreatedAt, UpdatedAt
                FROM ReferenceMetadata
                WHERE RefType = @param0 AND IsActive = 1
            `;
            const params: any[] = [refType];
            if (category) {
                query += ' AND Category = @param1';
                params.push(category);
            }
            query += ' ORDER BY Value ASC';
            const result = await dbService.executeQuery(query, params);
            return result.recordset || [];
        });
    }

    /**
     * Get distinct categories for a ref type — cached
     */
    static async getCategoriesByType(refType: string): Promise<string[]> {
        const cacheKey = `ref-cats:${refType}`;
        return refMetadataCache.getOrFetch(cacheKey, async () => {
            const result = await dbService.executeQuery(
                `SELECT DISTINCT Category FROM ReferenceMetadata
                 WHERE RefType = @param0 AND IsActive = 1 AND Category IS NOT NULL ORDER BY Category ASC`,
                [refType]
            );
            return (result.recordset || []).map((r: any) => r.Category);
        });
    }

    /**
     * Get all reference types with counts — cached
     */
    static async getAllReferenceTypes(): Promise<any[]> {
        return refMetadataCache.getOrFetch('ref-types', async () => {
            const result = await dbService.executeQuery(
                `SELECT RefType, COUNT(*) as Count FROM ReferenceMetadata WHERE IsActive = 1 GROUP BY RefType ORDER BY RefType ASC`
            );
            return result.recordset || [];
        });
    }

    /**
     * Bulk fetch multiple ref types — cached per combination
     */
    static async getBulkReferenceData(refTypes: string[]): Promise<Record<string, any[]>> {
        if (!refTypes?.length) return {};
        const sorted = [...refTypes].sort();
        const cacheKey = `ref-bulk:${sorted.join(',')}`;
        return refMetadataCache.getOrFetch(cacheKey, async () => {
            const placeholders = sorted.map((_, i) => `@param${i}`).join(',');
            const result = await dbService.executeQuery(
                `SELECT ReferenceID, RefType, Value, Category, Description, IsActive, CreatedAt, UpdatedAt
                 FROM ReferenceMetadata WHERE RefType IN (${placeholders}) AND IsActive = 1
                 ORDER BY RefType, Value ASC`,
                sorted
            );
            const grouped: Record<string, any[]> = {};
            (result.recordset || []).forEach((item: any) => {
                if (!grouped[item.RefType]) grouped[item.RefType] = [];
                grouped[item.RefType].push(item);
            });
            return grouped;
        });
    }

    // ── Organizations ───────────────────────────────────────────

    /**
     * Get organization list — cached for non-search, non-paginated requests.
     * Search & paginated requests bypass cache (user-specific).
     */
    static async getOrganizations(options: {
        search?: string;
        isFortune500?: boolean;
        limit?: number | null;
        offset?: number;
    } = {}): Promise<{ organizations: any[]; totalCount: number }> {
        const { search, isFortune500 = false, limit = null, offset = 0 } = options;
        const hasSearch = !!search?.trim();

        // Only cache the "get all" (no search, no pagination) case
        if (!hasSearch && !limit) {
            const cacheKey = isFortune500 ? 'orgs:f500' : 'orgs:all';
            return orgCache.getOrFetch(cacheKey, () => this._fetchOrganizations(options));
        }

        return this._fetchOrganizations(options);
    }

    private static async _fetchOrganizations(options: {
        search?: string;
        isFortune500?: boolean;
        limit?: number | null;
        offset?: number;
    }): Promise<{ organizations: any[]; totalCount: number }> {
        const { search, isFortune500 = false, limit = null, offset = 0 } = options;
        const hasSearch = !!search?.trim();

        const queryParams: any[] = [];
        let paramIndex = 0;
        let query: string;

        if (isFortune500 && !hasSearch) {
            query = `
                SELECT OrganizationID as id, Name as name, LogoURL as logoURL, Industry as industry,
                       IsFortune500 as isFortune500, ISNULL(Tier, 'Standard') as tier
                FROM Organizations
                WHERE IsActive = 1 AND IsFortune500 = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL)
                ORDER BY Name ASC
            `;
        } else if (hasSearch) {
            query = `
                SELECT OrganizationID as id, Name as name, LogoURL as logoURL, Industry as industry,
                       IsFortune500 as isFortune500, ISNULL(Tier, 'Standard') as tier
                FROM Organizations
                WHERE IsActive = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL) AND Name LIKE @param${paramIndex}
            `;
            queryParams.push(`%${search}%`);
            paramIndex++;
            if (isFortune500) query += ` AND IsFortune500 = 1`;
            query += ` ORDER BY CASE WHEN Tier = 'Elite' THEN 0 WHEN Tier = 'Premium' THEN 1 ELSE 2 END, Name ASC`;
        } else {
            query = `
                SELECT OrganizationID as id, Name as name, LogoURL as logoURL, Industry as industry,
                       IsFortune500 as isFortune500, ISNULL(Tier, 'Standard') as tier
                FROM Organizations
                WHERE IsActive = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL)
                ORDER BY CASE WHEN Tier = 'Elite' THEN 0 WHEN Tier = 'Premium' THEN 1 ELSE 2 END, Name ASC
            `;
        }

        if (limit) {
            query += ` OFFSET @param${paramIndex} ROWS FETCH NEXT @param${paramIndex + 1} ROWS ONLY`;
            queryParams.push(offset, limit);
        }

        const result = await dbService.executeQuery(query, queryParams);
        const organizations = result.recordset || [];

        let totalCount: number;
        if (!limit) {
            totalCount = organizations.length;
        } else {
            let countQuery = `SELECT COUNT(*) as total FROM Organizations WHERE IsActive = 1 AND (IsUserCreated = 0 OR IsUserCreated IS NULL)`;
            const countParams: any[] = [];
            let ci = 0;
            if (hasSearch) {
                countQuery += ` AND Name LIKE @param${ci}`;
                countParams.push(`%${search}%`);
                ci++;
            }
            if (isFortune500) countQuery += ` AND IsFortune500 = 1`;
            const countResult = await dbService.executeQuery(countQuery, countParams);
            totalCount = countResult.recordset[0]?.total || 0;
        }

        return { organizations, totalCount };
    }

    // ── Cache invalidation helpers ──────────────────────────────

    /** Call after modifying organizations (e.g., admin creates one) */
    static invalidateOrganizations(): void {
        orgCache.clear();
    }

    /** Call after modifying reference metadata */
    static invalidateReferenceMetadata(): void {
        refMetadataCache.clear();
    }

    /** Call after modifying currencies, referral plans, etc. */
    static invalidateLookups(): void {
        lookupCache.clear();
    }
}

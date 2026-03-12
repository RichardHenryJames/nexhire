import { dbService } from './database.service';

export interface ReferenceMetadataItem {
    ReferenceID: number;
    RefType: string;
    Value: string;
    Category: string | null;
    Description: string | null;
    IsActive: boolean;
    CreatedAt: Date;
    UpdatedAt: Date;
}

export class ReferenceMetadataService {
    /**
     * Get reference metadata by type — PERF: cached via ReferenceRepository (10 min TTL)
     */
    static async getReferenceByType(refType: string, category?: string): Promise<ReferenceMetadataItem[]> {
        try {
            const { ReferenceRepository } = await import('../repositories/reference.repository');
            return await ReferenceRepository.getReferenceByType(refType, category) as ReferenceMetadataItem[];
        } catch (error) {
            console.error(`Error getting reference metadata for type ${refType}:`, error);
            throw new Error(`Failed to fetch reference metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all categories for a specific ref type — PERF: cached via ReferenceRepository
     */
    static async getCategoriesByType(refType: string): Promise<string[]> {
        try {
            const { ReferenceRepository } = await import('../repositories/reference.repository');
            return await ReferenceRepository.getCategoriesByType(refType);
        } catch (error) {
            console.error(`Error getting categories for type ${refType}:`, error);
            throw new Error(`Failed to fetch categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Search reference metadata by value (for autocomplete/search features)
     * @param refType - Type of reference data
     * @param searchTerm - Search term
     * @param limit - Maximum number of results (default 20)
     * @returns Array of matching reference metadata items
     */
    static async searchReference(refType: string, searchTerm: string, limit: number = 20): Promise<ReferenceMetadataItem[]> {
        try {
            const query = `
                SELECT TOP (@param2)
                    ReferenceID,
                    RefType,
                    Value,
                    Category,
                    Description,
                    IsActive,
                    CreatedAt,
                    UpdatedAt
                FROM ReferenceMetadata
                WHERE RefType = @param0 
                    AND IsActive = 1
                    AND (Value LIKE '%' + @param1 + '%' OR Description LIKE '%' + @param1 + '%')
                ORDER BY 
                    CASE WHEN Value LIKE @param1 + '%' THEN 1 ELSE 2 END,
                    Value ASC
            `;
            
            const result = await dbService.executeQuery<ReferenceMetadataItem>(query, [refType, searchTerm, limit]);
            return result.recordset || [];
        } catch (error) {
            console.error(`Error searching reference metadata for type ${refType}:`, error);
            throw new Error(`Failed to search reference metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all reference types available in the system
     * @returns Array of unique reference types
     */
    static async getAllReferenceTypes(): Promise<{ RefType: string; Count: number }[]> {
        try {
            const { ReferenceRepository } = await import('../repositories/reference.repository');
            return await ReferenceRepository.getAllReferenceTypes();
        } catch (error) {
            console.error('Error getting all reference types:', error);
            throw new Error(`Failed to fetch reference types: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get reference metadata by ID
     * @param referenceId - ID of the reference item
     * @returns Single reference metadata item
     */
    static async getReferenceById(referenceId: number): Promise<ReferenceMetadataItem | null> {
        try {
            const query = `
                SELECT 
                    ReferenceID,
                    RefType,
                    Value,
                    Category,
                    Description,
                    IsActive,
                    CreatedAt,
                    UpdatedAt
                FROM ReferenceMetadata
                WHERE ReferenceID = @param0
            `;
            
            const result = await dbService.executeQuery<ReferenceMetadataItem>(query, [referenceId]);
            return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
        } catch (error) {
            console.error(`Error getting reference metadata by ID ${referenceId}:`, error);
            throw new Error(`Failed to fetch reference metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get multiple reference types in a single call (efficient for bulk loading)
     * @param refTypes - Array of reference types to fetch
     * @returns Object with reference types as keys and arrays of items as values
     */
    static async getBulkReferenceData(refTypes: string[]): Promise<Record<string, ReferenceMetadataItem[]>> {
        try {
            const { ReferenceRepository } = await import('../repositories/reference.repository');
            return await ReferenceRepository.getBulkReferenceData(refTypes) as Record<string, ReferenceMetadataItem[]>;
        } catch (error) {
            console.error('Error getting bulk reference data:', error);
            throw new Error(`Failed to fetch bulk reference data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

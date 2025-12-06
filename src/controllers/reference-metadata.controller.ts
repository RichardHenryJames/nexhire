import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ReferenceMetadataService } from '../services/reference-metadata.service';
import { AuthService } from '../services/auth.service';

/**
 * Get reference metadata
 * Query params:
 * - type: RefType (JobRole, Skill, Certification, Industry, Department)
 * - category: Optional category filter
 * - search: Optional search term
 * - limit: Optional limit for search results (default 20)
 */
export async function getReferenceMetadata(
    req: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        // Azure Functions v4: req.query is URLSearchParams
        const type = req.query.get('type') || undefined;
        const category = req.query.get('category') || undefined;
        const search = req.query.get('search') || undefined;
        const limit = req.query.get('limit') || undefined;

        // Search mode
        if (search && type) {
            const results = await ReferenceMetadataService.searchReference(
                type,
                search,
                limit ? parseInt(limit) : 20
            );
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data: results,
                    message: `Found ${results.length} results`,
                },
            };
        }

        // Get by type (with optional category filter)
        if (type) {
            const data = await ReferenceMetadataService.getReferenceByType(type, category);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    data,
                    message: `Retrieved ${data.length} items`,
                },
            };
        }

        // Get all types
        const types = await ReferenceMetadataService.getAllReferenceTypes();
        return {
            status: 200,
            jsonBody: {
                success: true,
                data: types,
                message: 'Available reference types',
            },
        };
    } catch (error) {
        console.error('Error getting reference metadata:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get reference metadata',
            },
        };
    }
}

/**
 * Get categories for a specific reference type
 */
export async function getCategoriesByType(
    req: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        const type = req.params.type;

        if (!type) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Type parameter is required',
                },
            };
        }

        const categories = await ReferenceMetadataService.getCategoriesByType(type);

        return {
            status: 200,
            jsonBody: {
                success: true,
                data: categories,
                message: `Found ${categories.length} categories for ${type}`,
            },
        };
    } catch (error) {
        console.error('Error getting categories:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get categories',
            },
        };
    }
}

/**
 * Bulk fetch multiple reference types in a single call
 * Request body: { types: string[] }
 */
export async function getBulkReferenceMetadata(
    req: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        const { types } = (await req.json()) as { types: string[] };

        if (!types || !Array.isArray(types) || types.length === 0) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'types array is required in request body',
                },
            };
        }

        if (types.length > 10) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Maximum 10 types can be fetched at once',
                },
            };
        }

        const data = await ReferenceMetadataService.getBulkReferenceData(types);

        return {
            status: 200,
            jsonBody: {
                success: true,
                data,
                message: `Retrieved ${Object.keys(data).length} reference types`,
            },
        };
    } catch (error) {
        console.error('Error getting bulk reference metadata:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get bulk reference metadata',
            },
        };
    }
}

/**
 * Get reference metadata by ID (for admin/debugging purposes)
 */
export async function getReferenceById(
    req: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        const referenceId = parseInt(req.params.id);

        if (isNaN(referenceId)) {
            return {
                status: 400,
                jsonBody: {
                    success: false,
                    error: 'Valid reference ID is required',
                },
            };
        }

        const data = await ReferenceMetadataService.getReferenceById(referenceId);

        if (!data) {
            return {
                status: 404,
                jsonBody: {
                    success: false,
                    error: 'Reference metadata not found',
                },
            };
        }

        return {
            status: 200,
            jsonBody: {
                success: true,
                data,
                message: 'Reference metadata retrieved successfully',
            },
        };
    } catch (error) {
        console.error('Error getting reference by ID:', error);
        return {
            status: 500,
            jsonBody: {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get reference metadata',
            },
        };
    }
}

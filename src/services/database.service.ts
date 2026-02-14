import sql from 'mssql';
import { dbConfig } from '../config';

interface DatabaseResult<T = any> {
    recordset: T[];
    recordsets?: any[]; // Simplified type to avoid complex mssql type conflicts
    rowsAffected?: number[];
}

export class DatabaseService {
    private static instance: DatabaseService;
    private pool: sql.ConnectionPool | null = null;
    private connecting: Promise<sql.ConnectionPool> | null = null;

    private constructor() {}

    // Singleton pattern
    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    // Get connection pool
    private async getPool(): Promise<sql.ConnectionPool> {
        if (this.pool && this.pool.connected) {
            return this.pool;
        }

        if (this.connecting) {
            return await this.connecting;
        }

        this.connecting = this.createConnection();
        this.pool = await this.connecting;
        this.connecting = null;

        return this.pool;
    }

    // Create database connection
    private async createConnection(): Promise<sql.ConnectionPool> {
        try {
            const pool = new sql.ConnectionPool(dbConfig);
            
            pool.on('error', (err) => {
                console.error('Database pool error:', err);
                this.pool = null;
            });

            await pool.connect();
            console.log('Connected to SQL Server');
            return pool;
        } catch (error) {
            console.error('Database connection failed:', error);
            throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Execute SQL query with parameters
    async executeQuery<T = any>(query: string, parameters: any[] = []): Promise<DatabaseResult<T>> {
        const pool = await this.getPool();
        const request = pool.request();

        // Add parameters to request
        parameters.forEach((param, index) => {
            request.input(`param${index}`, param);
        });

        try {
            const result = await request.query(query);
            return {
                recordset: result.recordset || [],
                recordsets: result.recordsets ? Array.from(Object.values(result.recordsets)) : undefined,
                rowsAffected: result.rowsAffected
            };
        } catch (error) {
            console.error('Query execution failed:', error);
            throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Execute stored procedure
    async executeStoredProcedure<T = any>(procedureName: string, parameters: { [key: string]: any } = {}): Promise<DatabaseResult<T>> {
        const pool = await this.getPool();
        const request = pool.request();

        // Add parameters to request
        Object.entries(parameters).forEach(([key, value]) => {
            request.input(key, value);
        });

        try {
            const result = await request.execute(procedureName);
            return {
                recordset: result.recordset || [],
                recordsets: result.recordsets ? Array.from(Object.values(result.recordsets)) : undefined,
                rowsAffected: result.rowsAffected
            };
        } catch (error) {
            console.error('Stored procedure execution failed:', error);
            throw new Error(`Stored procedure execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Begin transaction
    async beginTransaction(): Promise<sql.Transaction> {
        const pool = await this.getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        return transaction;
    }

    // Execute query within transaction
    async executeTransactionQuery<T = any>(
        transaction: sql.Transaction, 
        query: string, 
        parameters: any[] = []
    ): Promise<DatabaseResult<T>> {
        const request = new sql.Request(transaction);

        // Add parameters to request
        parameters.forEach((param, index) => {
            request.input(`param${index}`, param);
        });

        try {
            const result = await request.query(query);
            return {
                recordset: result.recordset || [],
                recordsets: result.recordsets ? Array.from(Object.values(result.recordsets)) : undefined,
                rowsAffected: result.rowsAffected
            };
        } catch (error) {
            console.error('Transaction query execution failed:', error);
            throw new Error(`Transaction query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Close all connections
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    // Test database connection
    async testConnection(): Promise<boolean> {
        try {
            await this.executeQuery('SELECT 1 as test');
            return true;
        } catch {
            return false;
        }
    }

    // Get database info
    async getDatabaseInfo(): Promise<any> {
        try {
            const result = await this.executeQuery(`
                SELECT 
                    @@VERSION as Version,
                    DB_NAME() as DatabaseName,
                    @@SERVERNAME as ServerName,
                    GETUTCDATE() as CurrentTime
            `);
            return result.recordset[0];
        } catch (error) {
            console.error('Failed to get database info:', error);
            return null;
        }
    }
}

// Export singleton instance
export const dbService = DatabaseService.getInstance();
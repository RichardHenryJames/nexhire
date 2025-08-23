"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = exports.DatabaseService = void 0;
const mssql_1 = __importDefault(require("mssql"));
const config_1 = require("../config");
class DatabaseService {
    constructor() {
        this.pool = null;
        this.connecting = null;
    }
    // Singleton pattern
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    // Get connection pool
    async getPool() {
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
    async createConnection() {
        try {
            const pool = new mssql_1.default.ConnectionPool(config_1.dbConfig);
            pool.on('error', (err) => {
                console.error('Database pool error:', err);
                this.pool = null;
            });
            await pool.connect();
            console.log('Connected to SQL Server');
            return pool;
        }
        catch (error) {
            console.error('Database connection failed:', error);
            throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Execute SQL query with parameters
    async executeQuery(query, parameters = []) {
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
        }
        catch (error) {
            console.error('Query execution failed:', error);
            throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Execute stored procedure
    async executeStoredProcedure(procedureName, parameters = {}) {
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
        }
        catch (error) {
            console.error('Stored procedure execution failed:', error);
            throw new Error(`Stored procedure execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Begin transaction
    async beginTransaction() {
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        return transaction;
    }
    // Execute query within transaction
    async executeTransactionQuery(transaction, query, parameters = []) {
        const request = new mssql_1.default.Request(transaction);
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
        }
        catch (error) {
            console.error('Transaction query execution failed:', error);
            throw new Error(`Transaction query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Close all connections
    async close() {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }
    // Test database connection
    async testConnection() {
        try {
            await this.executeQuery('SELECT 1 as test');
            return true;
        }
        catch {
            return false;
        }
    }
    // Get database info
    async getDatabaseInfo() {
        try {
            const result = await this.executeQuery(`
                SELECT 
                    @@VERSION as Version,
                    DB_NAME() as DatabaseName,
                    @@SERVERNAME as ServerName,
                    GETUTCDATE() as CurrentTime
            `);
            return result.recordset[0];
        }
        catch (error) {
            console.error('Failed to get database info:', error);
            return null;
        }
    }
}
exports.DatabaseService = DatabaseService;
// Export singleton instance
exports.dbService = DatabaseService.getInstance();
//# sourceMappingURL=database.service.js.map
import sql from 'mssql';
interface DatabaseResult<T = any> {
    recordset: T[];
    recordsets?: any[];
    rowsAffected?: number[];
}
export declare class DatabaseService {
    private static instance;
    private pool;
    private connecting;
    private constructor();
    static getInstance(): DatabaseService;
    private getPool;
    private createConnection;
    executeQuery<T = any>(query: string, parameters?: any[]): Promise<DatabaseResult<T>>;
    executeStoredProcedure<T = any>(procedureName: string, parameters?: {
        [key: string]: any;
    }): Promise<DatabaseResult<T>>;
    beginTransaction(): Promise<sql.Transaction>;
    executeTransactionQuery<T = any>(transaction: sql.Transaction, query: string, parameters?: any[]): Promise<DatabaseResult<T>>;
    close(): Promise<void>;
    testConnection(): Promise<boolean>;
    getDatabaseInfo(): Promise<any>;
}
export declare const dbService: DatabaseService;
export {};
//# sourceMappingURL=database.service.d.ts.map
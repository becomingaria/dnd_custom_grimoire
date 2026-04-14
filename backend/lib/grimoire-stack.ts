import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import { DynamoDBConstruct } from "./constructs/dynamodb-construct"
import { CognitoConstruct } from "./constructs/cognito-construct"
import { ApiConstruct } from "./constructs/api-construct"

export class GrimoireStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // ─── DynamoDB Tables ──────────────────────────────────────────────────────
        const database = new DynamoDBConstruct(this, "Database")

        // ─── Cognito Auth ─────────────────────────────────────────────────────────
        const auth = new CognitoConstruct(this, "Auth")

        // ─── API Gateway + Lambda Functions ───────────────────────────────────────
        const api = new ApiConstruct(this, "Api", {
            spellsTable: database.spellsTable,
            charactersTable: database.charactersTable,
            usernamesTable: database.usernamesTable,
            userPool: auth.userPool,
            userPoolClient: auth.userPoolClient,
        })

        // ─── Stack Outputs ────────────────────────────────────────────────────────
        new cdk.CfnOutput(this, "ApiUrl", {
            value: api.httpApi.apiEndpoint,
            description: "API Gateway HTTP endpoint URL",
            exportName: "GrimoireApiUrl",
        })

        new cdk.CfnOutput(this, "UserPoolId", {
            value: auth.userPool.userPoolId,
            description: "Cognito User Pool ID",
            exportName: "GrimoireUserPoolId",
        })

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: auth.userPoolClient.userPoolClientId,
            description: "Cognito User Pool Client ID",
            exportName: "GrimoireUserPoolClientId",
        })

        new cdk.CfnOutput(this, "SpellsTableName", {
            value: database.spellsTable.tableName,
            description: "DynamoDB Spells Table",
        })

        new cdk.CfnOutput(this, "CharactersTableName", {
            value: database.charactersTable.tableName,
            description: "DynamoDB Characters Table",
        })
    }
}

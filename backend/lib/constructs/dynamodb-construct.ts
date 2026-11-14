import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export class DynamoDBConstruct extends Construct {
    public readonly spellsTable: dynamodb.Table
    public readonly charactersTable: dynamodb.Table
    public readonly usernamesTable: dynamodb.Table
    public readonly settingsTable: dynamodb.Table

    constructor(scope: Construct, id: string) {
        super(scope, id)

        // ─── Spells Table ─────────────────────────────────────────────────────────
        this.spellsTable = new dynamodb.Table(this, "SpellsTable", {
            tableName: "grimoire-spells",
            partitionKey: {
                name: "spellId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        })

        // GSI: query homebrew spells by owning user
        this.spellsTable.addGlobalSecondaryIndex({
            indexName: "byUser",
            partitionKey: {
                name: "createdBy",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "createdAt",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        })

        // GSI: query spells by school
        this.spellsTable.addGlobalSecondaryIndex({
            indexName: "bySchool",
            partitionKey: {
                name: "school",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "name",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        })

        // Note: bySource GSI removed — spells now store `sources: string[]`
        // which cannot be used as a DynamoDB GSI partition key. Source filtering
        // is handled in-memory by the list Lambda.

        // ─── Characters Table ─────────────────────────────────────────────────────
        this.charactersTable = new dynamodb.Table(this, "CharactersTable", {
            tableName: "grimoire-characters",
            partitionKey: {
                name: "characterId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        })

        // GSI: query characters by owning user
        this.charactersTable.addGlobalSecondaryIndex({
            indexName: "byUser",
            partitionKey: {
                name: "userId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "createdAt",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        })

        // ─── Usernames Table ──────────────────────────────────────────────────────
        // Stores username → userId mapping for uniqueness enforcement.
        // PK is the lowercased username for case-insensitive uniqueness.
        this.usernamesTable = new dynamodb.Table(this, "UsernamesTable", {
            tableName: "grimoire-usernames",
            partitionKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        })

        // ─── Settings Table ───────────────────────────────────────────────────────
        // Small key/value store for site-wide admin settings (e.g. settingId
        // "patreon" holds the Patreon access policy and last sync report).
        this.settingsTable = new dynamodb.Table(this, "SettingsTable", {
            tableName: "grimoire-settings",
            partitionKey: {
                name: "settingId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        })
    }
}

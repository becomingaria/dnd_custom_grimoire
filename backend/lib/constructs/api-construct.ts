import * as cdk from "aws-cdk-lib"
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2"
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations"
import * as apigatewayv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as logs from "aws-cdk-lib/aws-logs"
import * as events from "aws-cdk-lib/aws-events"
import * as eventsTargets from "aws-cdk-lib/aws-events-targets"
import { Construct } from "constructs"
import * as path from "path"

interface ApiConstructProps {
    spellsTable: dynamodb.Table
    charactersTable: dynamodb.Table
    usernamesTable: dynamodb.Table
    settingsTable: dynamodb.Table
    userPool: cognito.UserPool
    userPoolClient: cognito.UserPoolClient
    /** Comma-separated emails that can never be demoted/disabled/deleted. */
    ownerEmails: string
}

export class ApiConstruct extends Construct {
    public readonly httpApi: apigatewayv2.HttpApi

    constructor(scope: Construct, id: string, props: ApiConstructProps) {
        super(scope, id)

        const {
            spellsTable,
            charactersTable,
            usernamesTable,
            settingsTable,
            userPool,
            userPoolClient,
            ownerEmails,
        } = props

        // ─── Shared Lambda Config ─────────────────────────────────────────────────
        const commonEnv = {
            SPELLS_TABLE: spellsTable.tableName,
            CHARACTERS_TABLE: charactersTable.tableName,
            REGION: cdk.Stack.of(this).region,
        }

        const commonProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "handler",
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: commonEnv,
            bundling: {
                externalModules: ["@aws-sdk/*"],
                minify: true,
                sourceMap: false,
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        }

        const lambdaDir = path.join(__dirname, "../../lambdas")

        // ─── Spell Lambda Functions ───────────────────────────────────────────────
        const createSpellFn = new lambdaNodejs.NodejsFunction(
            this,
            "CreateSpell",
            {
                ...commonProps,
                functionName: "grimoire-create-spell",
                entry: path.join(lambdaDir, "spells/create.ts"),
            },
        )

        const listSpellsFn = new lambdaNodejs.NodejsFunction(
            this,
            "ListSpells",
            {
                ...commonProps,
                functionName: "grimoire-list-spells",
                entry: path.join(lambdaDir, "spells/list.ts"),
            },
        )

        const getSpellFn = new lambdaNodejs.NodejsFunction(this, "GetSpell", {
            ...commonProps,
            functionName: "grimoire-get-spell",
            entry: path.join(lambdaDir, "spells/get.ts"),
        })

        const updateSpellFn = new lambdaNodejs.NodejsFunction(
            this,
            "UpdateSpell",
            {
                ...commonProps,
                functionName: "grimoire-update-spell",
                entry: path.join(lambdaDir, "spells/update.ts"),
            },
        )

        const deleteSpellFn = new lambdaNodejs.NodejsFunction(
            this,
            "DeleteSpell",
            {
                ...commonProps,
                functionName: "grimoire-delete-spell",
                entry: path.join(lambdaDir, "spells/delete.ts"),
            },
        )

        // ─── Character Lambda Functions ───────────────────────────────────────────
        const createCharacterFn = new lambdaNodejs.NodejsFunction(
            this,
            "CreateCharacter",
            {
                ...commonProps,
                functionName: "grimoire-create-character",
                entry: path.join(lambdaDir, "characters/create.ts"),
            },
        )

        const listCharactersFn = new lambdaNodejs.NodejsFunction(
            this,
            "ListCharacters",
            {
                ...commonProps,
                functionName: "grimoire-list-characters",
                entry: path.join(lambdaDir, "characters/list.ts"),
            },
        )

        const getCharacterFn = new lambdaNodejs.NodejsFunction(
            this,
            "GetCharacter",
            {
                ...commonProps,
                functionName: "grimoire-get-character",
                entry: path.join(lambdaDir, "characters/get.ts"),
            },
        )

        const updateCharacterFn = new lambdaNodejs.NodejsFunction(
            this,
            "UpdateCharacter",
            {
                ...commonProps,
                functionName: "grimoire-update-character",
                entry: path.join(lambdaDir, "characters/update.ts"),
            },
        )

        const deleteCharacterFn = new lambdaNodejs.NodejsFunction(
            this,
            "DeleteCharacter",
            {
                ...commonProps,
                functionName: "grimoire-delete-character",
                entry: path.join(lambdaDir, "characters/delete.ts"),
            },
        )

        // ─── User Lambda Functions ────────────────────────────────────────────────
        const setUsernameFn = new lambdaNodejs.NodejsFunction(
            this,
            "SetUsername",
            {
                ...commonProps,
                functionName: "grimoire-set-username",
                entry: path.join(lambdaDir, "users/setUsername.ts"),
                environment: {
                    ...commonEnv,
                    USERNAMES_TABLE: usernamesTable.tableName,
                    USER_POOL_ID: userPool.userPoolId,
                },
            },
        )

        // ─── Admin Lambda Function ────────────────────────────────────────────────
        // One handler serves every /admin/users route (see lambdas/admin/users.ts)
        const adminUsersFn = new lambdaNodejs.NodejsFunction(
            this,
            "AdminUsers",
            {
                ...commonProps,
                functionName: "grimoire-admin-users",
                entry: path.join(lambdaDir, "admin/users.ts"),
                environment: {
                    ...commonEnv,
                    USER_POOL_ID: userPool.userPoolId,
                    USERNAMES_TABLE: usernamesTable.tableName,
                    SETTINGS_TABLE: settingsTable.tableName,
                    OWNER_EMAILS: ownerEmails,
                },
            },
        )

        // ─── Patreon access (admin API + scheduled sync) ──────────────────────────
        const patreonParam = "/grimoire/patreon/credentials"
        const patreonEnv = {
            ...commonEnv,
            USER_POOL_ID: userPool.userPoolId,
            SETTINGS_TABLE: settingsTable.tableName,
            OWNER_EMAILS: ownerEmails,
            PATREON_PARAM: patreonParam,
        }
        const adminPatreonFn = new lambdaNodejs.NodejsFunction(
            this,
            "AdminPatreon",
            {
                ...commonProps,
                functionName: "grimoire-admin-patreon",
                entry: path.join(lambdaDir, "admin/patreon.ts"),
                timeout: cdk.Duration.seconds(60),
                environment: patreonEnv,
            },
        )
        const patreonSyncFn = new lambdaNodejs.NodejsFunction(
            this,
            "PatreonScheduledSync",
            {
                ...commonProps,
                functionName: "grimoire-patreon-sync",
                entry: path.join(lambdaDir, "patreon/scheduledSync.ts"),
                timeout: cdk.Duration.seconds(120),
                environment: patreonEnv,
            },
        )
        new events.Rule(this, "PatreonSyncSchedule", {
            description:
                "Patreon access sync (no-op unless an admin turned it on)",
            schedule: events.Schedule.rate(cdk.Duration.hours(6)),
            targets: [new eventsTargets.LambdaFunction(patreonSyncFn)],
        })

        const stack = cdk.Stack.of(this)
        for (const fn of [adminPatreonFn, patreonSyncFn]) {
            settingsTable.grantReadWriteData(fn)
            fn.addToRolePolicy(
                new iam.PolicyStatement({
                    actions: [
                        "cognito-idp:ListUsers",
                        "cognito-idp:ListUsersInGroup",
                        "cognito-idp:AdminEnableUser",
                        "cognito-idp:AdminDisableUser",
                        "cognito-idp:AdminUserGlobalSignOut",
                    ],
                    resources: [userPool.userPoolArn],
                }),
            )
            // SecureString with the AWS-managed aws/ssm key (usable via SSM).
            fn.addToRolePolicy(
                new iam.PolicyStatement({
                    actions: [
                        "ssm:GetParameter",
                        "ssm:PutParameter",
                        "ssm:DeleteParameter",
                    ],
                    resources: [
                        `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${patreonParam}`,
                    ],
                }),
            )
        }

        // ─── DynamoDB Permissions ─────────────────────────────────────────────────
        spellsTable.grantReadWriteData(createSpellFn)
        spellsTable.grantReadData(listSpellsFn)
        spellsTable.grantReadData(getSpellFn)
        // Visibility checks read the caller's spellbooks (shared/visibility.ts)
        charactersTable.grantReadData(listSpellsFn)
        charactersTable.grantReadData(getSpellFn)
        spellsTable.grantReadWriteData(updateSpellFn)
        spellsTable.grantReadWriteData(deleteSpellFn)

        charactersTable.grantReadWriteData(createCharacterFn)
        charactersTable.grantReadData(listCharactersFn)
        charactersTable.grantReadData(getCharacterFn)
        charactersTable.grantReadWriteData(updateCharacterFn)
        charactersTable.grantReadWriteData(deleteCharacterFn)

        usernamesTable.grantReadWriteData(setUsernameFn)
        setUsernameFn.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["cognito-idp:AdminUpdateUserAttributes"],
                resources: [userPool.userPoolArn],
            }),
        )

        charactersTable.grantReadWriteData(adminUsersFn)
        spellsTable.grantReadData(adminUsersFn)
        usernamesTable.grantReadWriteData(adminUsersFn)
        settingsTable.grantReadData(adminUsersFn)
        adminUsersFn.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "cognito-idp:ListUsers",
                    "cognito-idp:ListUsersInGroup",
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminListGroupsForUser",
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminAddUserToGroup",
                    "cognito-idp:AdminRemoveUserFromGroup",
                    "cognito-idp:AdminEnableUser",
                    "cognito-idp:AdminDisableUser",
                    "cognito-idp:AdminUserGlobalSignOut",
                    "cognito-idp:AdminDeleteUser",
                ],
                resources: [userPool.userPoolArn],
            }),
        )

        // ─── HTTP API Gateway ─────────────────────────────────────────────────────
        this.httpApi = new apigatewayv2.HttpApi(this, "GrimoireApi", {
            apiName: "grimoire-api",
            description: "DnD Grimoire REST API",
            corsPreflight: {
                allowHeaders: ["Content-Type", "Authorization"],
                allowMethods: [
                    apigatewayv2.CorsHttpMethod.GET,
                    apigatewayv2.CorsHttpMethod.POST,
                    apigatewayv2.CorsHttpMethod.PUT,
                    apigatewayv2.CorsHttpMethod.DELETE,
                    apigatewayv2.CorsHttpMethod.OPTIONS,
                ],
                allowOrigins: ["*"],
                maxAge: cdk.Duration.days(10),
            },
        })

        // ─── JWT Authorizer (Cognito) ─────────────────────────────────────────────
        const issuerUrl = `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`

        const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
            "CognitoAuthorizer",
            issuerUrl,
            {
                jwtAudience: [userPoolClient.userPoolClientId],
            },
        )

        // ─── Spell Routes ─────────────────────────────────────────────────────────
        this.httpApi.addRoutes({
            path: "/spells",
            methods: [apigatewayv2.HttpMethod.GET],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "ListSpellsInt",
                listSpellsFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/spells",
            methods: [apigatewayv2.HttpMethod.POST],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "CreateSpellInt",
                createSpellFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/spells/{spellId}",
            methods: [apigatewayv2.HttpMethod.GET],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "GetSpellInt",
                getSpellFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/spells/{spellId}",
            methods: [apigatewayv2.HttpMethod.PUT],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "UpdateSpellInt",
                updateSpellFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/spells/{spellId}",
            methods: [apigatewayv2.HttpMethod.DELETE],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "DeleteSpellInt",
                deleteSpellFn,
            ),
            authorizer,
        })

        // ─── Character Routes ─────────────────────────────────────────────────────
        this.httpApi.addRoutes({
            path: "/characters",
            methods: [apigatewayv2.HttpMethod.GET],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "ListCharsInt",
                listCharactersFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/characters",
            methods: [apigatewayv2.HttpMethod.POST],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "CreateCharInt",
                createCharacterFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/characters/{characterId}",
            methods: [apigatewayv2.HttpMethod.GET],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "GetCharInt",
                getCharacterFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/characters/{characterId}",
            methods: [apigatewayv2.HttpMethod.PUT],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "UpdateCharInt",
                updateCharacterFn,
            ),
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/characters/{characterId}",
            methods: [apigatewayv2.HttpMethod.DELETE],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "DeleteCharInt",
                deleteCharacterFn,
            ),
            authorizer,
        })

        // ─── User Routes ──────────────────────────────────────────────────────────
        this.httpApi.addRoutes({
            path: "/users/username",
            methods: [apigatewayv2.HttpMethod.PUT],
            integration: new apigatewayv2Integrations.HttpLambdaIntegration(
                "SetUsernameInt",
                setUsernameFn,
            ),
            authorizer,
        })

        // ─── Admin Routes (Admin group enforced inside the Lambda) ────────────────
        const adminIntegration =
            new apigatewayv2Integrations.HttpLambdaIntegration(
                "AdminUsersInt",
                adminUsersFn,
            )

        this.httpApi.addRoutes({
            path: "/admin/users",
            methods: [
                apigatewayv2.HttpMethod.GET,
                apigatewayv2.HttpMethod.POST,
            ],
            integration: adminIntegration,
            authorizer,
        })

        this.httpApi.addRoutes({
            path: "/admin/users/{username}",
            methods: [
                apigatewayv2.HttpMethod.PUT,
                apigatewayv2.HttpMethod.DELETE,
            ],
            integration: adminIntegration,
            authorizer,
        })

        const patreonIntegration =
            new apigatewayv2Integrations.HttpLambdaIntegration(
                "AdminPatreonInt",
                adminPatreonFn,
            )
        this.httpApi.addRoutes({
            path: "/admin/patreon",
            methods: [
                apigatewayv2.HttpMethod.GET,
                apigatewayv2.HttpMethod.PUT,
                apigatewayv2.HttpMethod.DELETE,
            ],
            integration: patreonIntegration,
            authorizer,
        })
        this.httpApi.addRoutes({
            path: "/admin/patreon/sync",
            methods: [apigatewayv2.HttpMethod.POST],
            integration: patreonIntegration,
            authorizer,
        })

        // Legacy alias kept so an older frontend build keeps working.
        this.httpApi.addRoutes({
            path: "/users/invite",
            methods: [apigatewayv2.HttpMethod.POST],
            integration: adminIntegration,
            authorizer,
        })
    }
}

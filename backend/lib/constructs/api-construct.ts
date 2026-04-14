import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiConstructProps {
  spellsTable: dynamodb.Table;
  charactersTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiConstruct extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { spellsTable, charactersTable, userPool, userPoolClient } = props;

    // ─── Shared Lambda Config ─────────────────────────────────────────────────
    const commonEnv = {
      SPELLS_TABLE: spellsTable.tableName,
      CHARACTERS_TABLE: charactersTable.tableName,
      REGION: cdk.Stack.of(this).region,
    };

    const commonProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        minify: true,
        sourceMap: false,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    };

    const lambdaDir = path.join(__dirname, '../../lambdas');

    // ─── Spell Lambda Functions ───────────────────────────────────────────────
    const createSpellFn = new lambdaNodejs.NodejsFunction(this, 'CreateSpell', {
      ...commonProps,
      functionName: 'grimoire-create-spell',
      entry: path.join(lambdaDir, 'spells/create.ts'),
    });

    const listSpellsFn = new lambdaNodejs.NodejsFunction(this, 'ListSpells', {
      ...commonProps,
      functionName: 'grimoire-list-spells',
      entry: path.join(lambdaDir, 'spells/list.ts'),
    });

    const getSpellFn = new lambdaNodejs.NodejsFunction(this, 'GetSpell', {
      ...commonProps,
      functionName: 'grimoire-get-spell',
      entry: path.join(lambdaDir, 'spells/get.ts'),
    });

    const updateSpellFn = new lambdaNodejs.NodejsFunction(this, 'UpdateSpell', {
      ...commonProps,
      functionName: 'grimoire-update-spell',
      entry: path.join(lambdaDir, 'spells/update.ts'),
    });

    const deleteSpellFn = new lambdaNodejs.NodejsFunction(this, 'DeleteSpell', {
      ...commonProps,
      functionName: 'grimoire-delete-spell',
      entry: path.join(lambdaDir, 'spells/delete.ts'),
    });

    // ─── Character Lambda Functions ───────────────────────────────────────────
    const createCharacterFn = new lambdaNodejs.NodejsFunction(this, 'CreateCharacter', {
      ...commonProps,
      functionName: 'grimoire-create-character',
      entry: path.join(lambdaDir, 'characters/create.ts'),
    });

    const listCharactersFn = new lambdaNodejs.NodejsFunction(this, 'ListCharacters', {
      ...commonProps,
      functionName: 'grimoire-list-characters',
      entry: path.join(lambdaDir, 'characters/list.ts'),
    });

    const getCharacterFn = new lambdaNodejs.NodejsFunction(this, 'GetCharacter', {
      ...commonProps,
      functionName: 'grimoire-get-character',
      entry: path.join(lambdaDir, 'characters/get.ts'),
    });

    const updateCharacterFn = new lambdaNodejs.NodejsFunction(this, 'UpdateCharacter', {
      ...commonProps,
      functionName: 'grimoire-update-character',
      entry: path.join(lambdaDir, 'characters/update.ts'),
    });

    const deleteCharacterFn = new lambdaNodejs.NodejsFunction(this, 'DeleteCharacter', {
      ...commonProps,
      functionName: 'grimoire-delete-character',
      entry: path.join(lambdaDir, 'characters/delete.ts'),
    });

    // ─── DynamoDB Permissions ─────────────────────────────────────────────────
    spellsTable.grantReadWriteData(createSpellFn);
    spellsTable.grantReadData(listSpellsFn);
    spellsTable.grantReadData(getSpellFn);
    spellsTable.grantReadWriteData(updateSpellFn);
    spellsTable.grantReadWriteData(deleteSpellFn);

    charactersTable.grantReadWriteData(createCharacterFn);
    charactersTable.grantReadData(listCharactersFn);
    charactersTable.grantReadData(getCharacterFn);
    charactersTable.grantReadWriteData(updateCharacterFn);
    charactersTable.grantReadWriteData(deleteCharacterFn);

    // ─── HTTP API Gateway ─────────────────────────────────────────────────────
    this.httpApi = new apigatewayv2.HttpApi(this, 'GrimoireApi', {
      apiName: 'grimoire-api',
      description: 'DnD Grimoire REST API',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(10),
      },
    });

    // ─── JWT Authorizer (Cognito) ─────────────────────────────────────────────
    const issuerUrl = `https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`;

    const authorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      issuerUrl,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );

    // ─── Spell Routes ─────────────────────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/spells',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('ListSpellsInt', listSpellsFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/spells',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('CreateSpellInt', createSpellFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/spells/{spellId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetSpellInt', getSpellFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/spells/{spellId}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('UpdateSpellInt', updateSpellFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/spells/{spellId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('DeleteSpellInt', deleteSpellFn),
      authorizer,
    });

    // ─── Character Routes ─────────────────────────────────────────────────────
    this.httpApi.addRoutes({
      path: '/characters',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('ListCharsInt', listCharactersFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/characters',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('CreateCharInt', createCharacterFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/characters/{characterId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('GetCharInt', getCharacterFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/characters/{characterId}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('UpdateCharInt', updateCharacterFn),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/characters/{characterId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('DeleteCharInt', deleteCharacterFn),
      authorizer,
    });
  }
}

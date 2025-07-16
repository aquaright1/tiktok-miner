/**
 * Apify Client SDK type definitions
 */

export interface ApifyConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
}

export interface ActorRun {
  id: string;
  actorId: string;
  status: ActorRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  buildId: string;
  buildNumber: string;
  exitCode?: number;
  defaultKeyValueStoreId: string;
  defaultDatasetId: string;
  defaultRequestQueueId?: string;
  statusMessage?: string;
  isStatusMessageTerminal?: boolean;
  meta?: ActorRunMeta;
  options?: ActorRunOptions;
  usage?: ActorRunUsage;
}

export enum ActorRunStatus {
  READY = 'READY',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED-OUT',
  ABORTED = 'ABORTED',
  ABORTING = 'ABORTING',
}

export interface ActorRunMeta {
  origin: string;
  clientIp: string;
  userAgent: string;
}

export interface ActorRunOptions {
  build?: string;
  timeoutSecs?: number;
  memoryMbytes?: number;
  diskMbytes?: number;
}

export interface ActorRunUsage {
  ACTOR_COMPUTE_UNITS?: number;
  DATASET_READS?: number;
  DATASET_WRITES?: number;
  KEY_VALUE_STORE_READS?: number;
  KEY_VALUE_STORE_WRITES?: number;
  KEY_VALUE_STORE_LISTS?: number;
  REQUEST_QUEUE_READS?: number;
  REQUEST_QUEUE_WRITES?: number;
  DATA_TRANSFER_INTERNAL_GBYTES?: number;
  DATA_TRANSFER_EXTERNAL_GBYTES?: number;
  PROXY_RESIDENTIAL_TRANSFER_GBYTES?: number;
  PROXY_SERPS?: number;
}

export interface ActorInput {
  [key: string]: any;
}

export interface ActorStartOptions {
  actorId: string;
  input?: ActorInput;
  contentType?: string;
  build?: string;
  timeoutSecs?: number;
  memoryMbytes?: number;
  maxItems?: number;
  webhooks?: WebhookConfig[];
  waitForFinish?: number;
}

export interface WebhookConfig {
  eventTypes: WebhookEventType[];
  requestUrl: string;
  payloadTemplate?: string;
  headersTemplate?: string;
  description?: string;
  ignoreSslErrors?: boolean;
  doNotRetry?: boolean;
  idempotencyKey?: string;
  isAdHoc?: boolean;
}

export enum WebhookEventType {
  ACTOR_RUN_CREATED = 'ACTOR.RUN.CREATED',
  ACTOR_RUN_SUCCEEDED = 'ACTOR.RUN.SUCCEEDED',
  ACTOR_RUN_FAILED = 'ACTOR.RUN.FAILED',
  ACTOR_RUN_TIMED_OUT = 'ACTOR.RUN.TIMED_OUT',
  ACTOR_RUN_ABORTED = 'ACTOR.RUN.ABORTED',
  ACTOR_RUN_RESURRECTED = 'ACTOR.RUN.RESURRECTED',
}

export interface DatasetItem {
  [key: string]: any;
}

export interface DatasetListOptions {
  offset?: number;
  limit?: number;
  desc?: boolean;
  fields?: string[];
  omit?: string[];
  unwind?: string;
  clean?: boolean;
  simplified?: boolean;
  skipEmpty?: boolean;
  skipHidden?: boolean;
  skipHeaderRow?: boolean;
  format?: DatasetFormat;
  flatten?: string[];
  xmlRoot?: string;
  xmlRow?: string;
}

export enum DatasetFormat {
  JSON = 'json',
  JSONL = 'jsonl',
  XML = 'xml',
  HTML = 'html',
  CSV = 'csv',
  XLSX = 'xlsx',
  RSS = 'rss',
}

export interface KeyValueStoreRecord {
  key: string;
  value: any;
  contentType?: string;
}

export interface ApifyError extends Error {
  type: string;
  statusCode?: number;
  details?: any;
}

export interface ActorCallResult {
  runId: string;
  status: ActorRunStatus;
  datasetId?: string;
  keyValueStoreId?: string;
  startedAt: Date;
  finishedAt?: Date;
  exitCode?: number;
  output?: any;
}

export interface ActorInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  title?: string;
  description?: string;
  restartOnError?: boolean;
  isPublic?: boolean;
  createdAt: Date;
  modifiedAt: Date;
  stats: ActorStats;
  versions: ActorVersion[];
  defaultRunOptions?: ActorRunOptions;
  exampleRunInput?: ActorInput;
  isDeprecated?: boolean;
  deploymentKey?: string;
  latestVersion?: ActorVersion;
}

export interface ActorStats {
  totalBuilds?: number;
  totalRuns?: number;
  totalUsers?: number;
  totalMetamorphs?: number;
  lastRunStartedAt?: Date;
  totalComputeUnits?: number;
  totalUsd?: number;
}

export interface ActorVersion {
  versionNumber: string;
  buildTag?: string;
  envVars?: Array<{ name: string; value: string; isSecret?: boolean }>;
  applyEnvVarsToBuild?: boolean;
  sourceType: string;
  gitRepoUrl?: string;
}

export interface ApifyClientOptions {
  token: string;
  baseUrl?: string;
  maxRetries?: number;
  minDelayBetweenRetriesMillis?: number;
  requestTimeoutSecs?: number;
  logLevel?: string;
  httpClient?: any;
}

export enum LogLevel {
  OFF = 'OFF',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export interface PaginatedList<T> {
  items: T[];
  offset: number;
  limit: number;
  count: number;
  total: number;
}

export interface RequestQueueRequest {
  id: string;
  uniqueKey: string;
  url: string;
  method?: string;
  retryCount?: number;
  requestedAt?: Date;
  userData?: any;
  headers?: Record<string, string>;
  payload?: string;
  noRetry?: boolean;
  handledAt?: Date;
  errorMessages?: string[];
}

export interface ApifyActorConfig {
  actorId: string;
  defaultInput?: ActorInput;
  defaultRunOptions?: ActorRunOptions;
  webhooks?: WebhookConfig[];
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ScraperActorInput {
  startUrls: Array<{ url: string; method?: string; userData?: any }>;
  maxRequestsPerCrawl?: number;
  handlePageTimeoutSecs?: number;
  proxyConfiguration?: {
    useApifyProxy?: boolean;
    proxyUrls?: string[];
    countryCode?: string;
  };
  customData?: any;
}

export interface InstagramScraperInput extends ScraperActorInput {
  directUrls?: string[];
  search?: string;
  resultsType?: 'posts' | 'details' | 'comments';
  resultsLimit?: number;
  searchType?: 'hashtag' | 'user' | 'place' | 'url';
  searchLimit?: number;
  extendOutputFunction?: string;
  extendScraperFunction?: string;
  customData?: any;
  proxy?: {
    useApifyProxy?: boolean;
    proxyUrls?: string[];
  };
}

export interface TikTokScraperInput extends ScraperActorInput {
  profiles?: string[];
  hashtags?: string[];
  searchQueries?: string[];
  postURLs?: string[];
  resultsPerPage?: number;
  maxProfilesPerQuery?: number;
  proxyConfiguration?: {
    useApifyProxy?: boolean;
  };
}

export interface DatasetExportOptions {
  format: DatasetFormat;
  fields?: string[];
  omit?: string[];
  limit?: number;
  offset?: number;
  desc?: boolean;
  skipEmpty?: boolean;
  skipHeaderRow?: boolean;
  xml?: {
    root?: string;
    row?: string;
  };
}
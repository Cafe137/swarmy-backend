import { update, insert, getRows, getOnlyRowOrNull, getOnlyRowOrThrow } from './Database'

type SelectOptions<T> = {
    order?: { column: keyof T, direction: 'ASC' | 'DESC' },
    limit?: number
}

function buildSelect<T>(filter?: Partial<T>, options?: SelectOptions<T>): [string, unknown[]] {
    const where = filter ? ' WHERE ' + Object.keys(filter).map(x => '' + x + ' = ?').join(' AND ') : ''
    const values = filter ? Object.values(filter) : []
    const order = options?.order ? ' ORDER BY ' + (options.order.column as string) + ' ' + options.order.direction : ''
    const limit = options?.limit ? ' LIMIT ' + options.limit : ''
    return [where + order + limit, values]
}

export type ApiKeysRowId = number & { __brand: 'ApiKeysRowId' };
export interface ApiKeysRow {
id: ApiKeysRowId
organizationId: OrganizationsRowId
apiKey: string
status: 'ACTIVE' | 'REVOKED'
createdAt: Date
}

export type BeesRowId = number & { __brand: 'BeesRowId' };
export interface BeesRow {
id: BeesRowId
name: string
url: string
enabled: 0 | 1
uploadEnabled: 0 | 1
downloadEnabled: 0 | 1
}

export type FileReferencesRowId = number & { __brand: 'FileReferencesRowId' };
export interface FileReferencesRow {
id: FileReferencesRowId
organizationId: OrganizationsRowId
thumbnailBase64?: string | null
name: string
contentType: string
hash: string
size: number
hits: number
isWebsite: 0 | 1
createdAt: Date
}

export type OrganizationsRowId = number & { __brand: 'OrganizationsRowId' };
export interface OrganizationsRow {
id: OrganizationsRowId
name: string
stripeIdentifier: string
postageBatchId?: string | null
enabled: 0 | 1
createdAt: Date
}

export type PaymentsRowId = number & { __brand: 'PaymentsRowId' };
export interface PaymentsRow {
id: PaymentsRowId
merchantTransactionId: string
organizationId: OrganizationsRowId
planId: PlansRowId
amount: number
currency: string
status: 'PENDING' | 'SUCCESS' | 'FAILURE'
statusReasonCode?: string | null
createdAt: Date
}

export type PlansRowId = number & { __brand: 'PlansRowId' };
export interface PlansRow {
id: PlansRowId
organizationId: OrganizationsRowId
amount: number
currency: string
frequency: string
status: 'PENDING_PAYMENT' | 'ACTIVE' | 'CANCELLED'
statusReason?: string | null
downloadCountLimit: number
downloadSizeLimit: number
uploadCountLimit: number
uploadSizeLimit: number
paidUntil?: Date | null
createdAt: Date
}

export type PostageCreationQueueRowId = number & { __brand: 'PostageCreationQueueRowId' };
export interface PostageCreationQueueRow {
id: PostageCreationQueueRowId
organizationId: OrganizationsRowId
depth: number
amount: number
createdAt: Date
}

export type PostageDiluteQueueRowId = number & { __brand: 'PostageDiluteQueueRowId' };
export interface PostageDiluteQueueRow {
id: PostageDiluteQueueRowId
organizationId: OrganizationsRowId
postageBatchId: string
depth: number
createdAt: Date
}

export type PostageTopUpQueueRowId = number & { __brand: 'PostageTopUpQueueRowId' };
export interface PostageTopUpQueueRow {
id: PostageTopUpQueueRowId
organizationId: OrganizationsRowId
postageBatchId: string
amount: number
createdAt: Date
}

export type StaticTextsRowId = number & { __brand: 'StaticTextsRowId' };
export interface StaticTextsRow {
id: StaticTextsRowId
label: string
value: string
}

export type UsageMetricsRowId = number & { __brand: 'UsageMetricsRowId' };
export interface UsageMetricsRow {
id: UsageMetricsRowId
organizationId: OrganizationsRowId
type: 'UPLOADED_BYTES' | 'DOWNLOADED_BYTES'
available: number
used: number
periodEndsAt: Date
}

export type UsersRowId = number & { __brand: 'UsersRowId' };
export interface UsersRow {
id: UsersRowId
email: string
password: string
organizationId: OrganizationsRowId
emailVerified: 0 | 1
emailVerificationCode: string
resetPasswordToken?: string | null
enabled: 0 | 1
createdAt: Date
}


export interface NewApiKeysRow {
organizationId: OrganizationsRowId
apiKey: string
status: 'ACTIVE' | 'REVOKED'
createdAt?: Date | null
}

export interface NewBeesRow {
name: string
url: string
enabled?: 0 | 1 | null
uploadEnabled?: 0 | 1 | null
downloadEnabled?: 0 | 1 | null
}

export interface NewFileReferencesRow {
organizationId: OrganizationsRowId
thumbnailBase64?: string | null
name: string
contentType: string
hash: string
size: number
hits?: number | null
isWebsite: 0 | 1
createdAt?: Date | null
}

export interface NewOrganizationsRow {
name: string
stripeIdentifier: string
postageBatchId?: string | null
enabled?: 0 | 1 | null
createdAt?: Date | null
}

export interface NewPaymentsRow {
merchantTransactionId: string
organizationId: OrganizationsRowId
planId: PlansRowId
amount: number
currency: string
status: 'PENDING' | 'SUCCESS' | 'FAILURE'
statusReasonCode?: string | null
createdAt?: Date | null
}

export interface NewPlansRow {
organizationId: OrganizationsRowId
amount: number
currency: string
frequency: string
status: 'PENDING_PAYMENT' | 'ACTIVE' | 'CANCELLED'
statusReason?: string | null
downloadCountLimit: number
downloadSizeLimit: number
uploadCountLimit: number
uploadSizeLimit: number
paidUntil?: Date | null
createdAt?: Date | null
}

export interface NewPostageCreationQueueRow {
organizationId: OrganizationsRowId
depth: number
amount: number
createdAt?: Date | null
}

export interface NewPostageDiluteQueueRow {
organizationId: OrganizationsRowId
postageBatchId: string
depth: number
createdAt?: Date | null
}

export interface NewPostageTopUpQueueRow {
organizationId: OrganizationsRowId
postageBatchId: string
amount: number
createdAt?: Date | null
}

export interface NewStaticTextsRow {
label: string
value: string
}

export interface NewUsageMetricsRow {
organizationId: OrganizationsRowId
type: 'UPLOADED_BYTES' | 'DOWNLOADED_BYTES'
available: number
used?: number | null
periodEndsAt: Date
}

export interface NewUsersRow {
email: string
password: string
organizationId: OrganizationsRowId
emailVerified?: 0 | 1 | null
emailVerificationCode: string
resetPasswordToken?: string | null
enabled?: 0 | 1 | null
createdAt?: Date | null
}


export async function getApiKeysRows(
            filter?: Partial<ApiKeysRow>,
            options?: SelectOptions<ApiKeysRow>
        ): Promise<ApiKeysRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.apiKeys' + query, ...values) as unknown as ApiKeysRow[]
    }

export async function getOnlyApiKeysRowOrNull(
            filter?: Partial<ApiKeysRow>,
            options?: SelectOptions<ApiKeysRow>
        ): Promise<ApiKeysRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.apiKeys' + query, ...values) as unknown as ApiKeysRow | null
    }

export async function getOnlyApiKeysRowOrThrow(
            filter?: Partial<ApiKeysRow>,
            options?: SelectOptions<ApiKeysRow>
        ): Promise<ApiKeysRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.apiKeys' + query, ...values) as unknown as ApiKeysRow
    }

export async function getBeesRows(
            filter?: Partial<BeesRow>,
            options?: SelectOptions<BeesRow>
        ): Promise<BeesRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.bees' + query, ...values) as unknown as BeesRow[]
    }

export async function getOnlyBeesRowOrNull(
            filter?: Partial<BeesRow>,
            options?: SelectOptions<BeesRow>
        ): Promise<BeesRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.bees' + query, ...values) as unknown as BeesRow | null
    }

export async function getOnlyBeesRowOrThrow(
            filter?: Partial<BeesRow>,
            options?: SelectOptions<BeesRow>
        ): Promise<BeesRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.bees' + query, ...values) as unknown as BeesRow
    }

export async function getFileReferencesRows(
            filter?: Partial<FileReferencesRow>,
            options?: SelectOptions<FileReferencesRow>
        ): Promise<FileReferencesRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.fileReferences' + query, ...values) as unknown as FileReferencesRow[]
    }

export async function getOnlyFileReferencesRowOrNull(
            filter?: Partial<FileReferencesRow>,
            options?: SelectOptions<FileReferencesRow>
        ): Promise<FileReferencesRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.fileReferences' + query, ...values) as unknown as FileReferencesRow | null
    }

export async function getOnlyFileReferencesRowOrThrow(
            filter?: Partial<FileReferencesRow>,
            options?: SelectOptions<FileReferencesRow>
        ): Promise<FileReferencesRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.fileReferences' + query, ...values) as unknown as FileReferencesRow
    }

export async function getOrganizationsRows(
            filter?: Partial<OrganizationsRow>,
            options?: SelectOptions<OrganizationsRow>
        ): Promise<OrganizationsRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.organizations' + query, ...values) as unknown as OrganizationsRow[]
    }

export async function getOnlyOrganizationsRowOrNull(
            filter?: Partial<OrganizationsRow>,
            options?: SelectOptions<OrganizationsRow>
        ): Promise<OrganizationsRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.organizations' + query, ...values) as unknown as OrganizationsRow | null
    }

export async function getOnlyOrganizationsRowOrThrow(
            filter?: Partial<OrganizationsRow>,
            options?: SelectOptions<OrganizationsRow>
        ): Promise<OrganizationsRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.organizations' + query, ...values) as unknown as OrganizationsRow
    }

export async function getPaymentsRows(
            filter?: Partial<PaymentsRow>,
            options?: SelectOptions<PaymentsRow>
        ): Promise<PaymentsRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.payments' + query, ...values) as unknown as PaymentsRow[]
    }

export async function getOnlyPaymentsRowOrNull(
            filter?: Partial<PaymentsRow>,
            options?: SelectOptions<PaymentsRow>
        ): Promise<PaymentsRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.payments' + query, ...values) as unknown as PaymentsRow | null
    }

export async function getOnlyPaymentsRowOrThrow(
            filter?: Partial<PaymentsRow>,
            options?: SelectOptions<PaymentsRow>
        ): Promise<PaymentsRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.payments' + query, ...values) as unknown as PaymentsRow
    }

export async function getPlansRows(
            filter?: Partial<PlansRow>,
            options?: SelectOptions<PlansRow>
        ): Promise<PlansRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.plans' + query, ...values) as unknown as PlansRow[]
    }

export async function getOnlyPlansRowOrNull(
            filter?: Partial<PlansRow>,
            options?: SelectOptions<PlansRow>
        ): Promise<PlansRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.plans' + query, ...values) as unknown as PlansRow | null
    }

export async function getOnlyPlansRowOrThrow(
            filter?: Partial<PlansRow>,
            options?: SelectOptions<PlansRow>
        ): Promise<PlansRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.plans' + query, ...values) as unknown as PlansRow
    }

export async function getPostageCreationQueueRows(
            filter?: Partial<PostageCreationQueueRow>,
            options?: SelectOptions<PostageCreationQueueRow>
        ): Promise<PostageCreationQueueRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.postageCreationQueue' + query, ...values) as unknown as PostageCreationQueueRow[]
    }

export async function getOnlyPostageCreationQueueRowOrNull(
            filter?: Partial<PostageCreationQueueRow>,
            options?: SelectOptions<PostageCreationQueueRow>
        ): Promise<PostageCreationQueueRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.postageCreationQueue' + query, ...values) as unknown as PostageCreationQueueRow | null
    }

export async function getOnlyPostageCreationQueueRowOrThrow(
            filter?: Partial<PostageCreationQueueRow>,
            options?: SelectOptions<PostageCreationQueueRow>
        ): Promise<PostageCreationQueueRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.postageCreationQueue' + query, ...values) as unknown as PostageCreationQueueRow
    }

export async function getPostageDiluteQueueRows(
            filter?: Partial<PostageDiluteQueueRow>,
            options?: SelectOptions<PostageDiluteQueueRow>
        ): Promise<PostageDiluteQueueRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.postageDiluteQueue' + query, ...values) as unknown as PostageDiluteQueueRow[]
    }

export async function getOnlyPostageDiluteQueueRowOrNull(
            filter?: Partial<PostageDiluteQueueRow>,
            options?: SelectOptions<PostageDiluteQueueRow>
        ): Promise<PostageDiluteQueueRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.postageDiluteQueue' + query, ...values) as unknown as PostageDiluteQueueRow | null
    }

export async function getOnlyPostageDiluteQueueRowOrThrow(
            filter?: Partial<PostageDiluteQueueRow>,
            options?: SelectOptions<PostageDiluteQueueRow>
        ): Promise<PostageDiluteQueueRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.postageDiluteQueue' + query, ...values) as unknown as PostageDiluteQueueRow
    }

export async function getPostageTopUpQueueRows(
            filter?: Partial<PostageTopUpQueueRow>,
            options?: SelectOptions<PostageTopUpQueueRow>
        ): Promise<PostageTopUpQueueRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.postageTopUpQueue' + query, ...values) as unknown as PostageTopUpQueueRow[]
    }

export async function getOnlyPostageTopUpQueueRowOrNull(
            filter?: Partial<PostageTopUpQueueRow>,
            options?: SelectOptions<PostageTopUpQueueRow>
        ): Promise<PostageTopUpQueueRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.postageTopUpQueue' + query, ...values) as unknown as PostageTopUpQueueRow | null
    }

export async function getOnlyPostageTopUpQueueRowOrThrow(
            filter?: Partial<PostageTopUpQueueRow>,
            options?: SelectOptions<PostageTopUpQueueRow>
        ): Promise<PostageTopUpQueueRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.postageTopUpQueue' + query, ...values) as unknown as PostageTopUpQueueRow
    }

export async function getStaticTextsRows(
            filter?: Partial<StaticTextsRow>,
            options?: SelectOptions<StaticTextsRow>
        ): Promise<StaticTextsRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.staticTexts' + query, ...values) as unknown as StaticTextsRow[]
    }

export async function getOnlyStaticTextsRowOrNull(
            filter?: Partial<StaticTextsRow>,
            options?: SelectOptions<StaticTextsRow>
        ): Promise<StaticTextsRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.staticTexts' + query, ...values) as unknown as StaticTextsRow | null
    }

export async function getOnlyStaticTextsRowOrThrow(
            filter?: Partial<StaticTextsRow>,
            options?: SelectOptions<StaticTextsRow>
        ): Promise<StaticTextsRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.staticTexts' + query, ...values) as unknown as StaticTextsRow
    }

export async function getUsageMetricsRows(
            filter?: Partial<UsageMetricsRow>,
            options?: SelectOptions<UsageMetricsRow>
        ): Promise<UsageMetricsRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.usageMetrics' + query, ...values) as unknown as UsageMetricsRow[]
    }

export async function getOnlyUsageMetricsRowOrNull(
            filter?: Partial<UsageMetricsRow>,
            options?: SelectOptions<UsageMetricsRow>
        ): Promise<UsageMetricsRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.usageMetrics' + query, ...values) as unknown as UsageMetricsRow | null
    }

export async function getOnlyUsageMetricsRowOrThrow(
            filter?: Partial<UsageMetricsRow>,
            options?: SelectOptions<UsageMetricsRow>
        ): Promise<UsageMetricsRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.usageMetrics' + query, ...values) as unknown as UsageMetricsRow
    }

export async function getUsersRows(
            filter?: Partial<UsersRow>,
            options?: SelectOptions<UsersRow>
        ): Promise<UsersRow[]> {
        const [query, values] = buildSelect(filter, options)
        return getRows('SELECT * FROM swarmy_test.users' + query, ...values) as unknown as UsersRow[]
    }

export async function getOnlyUsersRowOrNull(
            filter?: Partial<UsersRow>,
            options?: SelectOptions<UsersRow>
        ): Promise<UsersRow | null> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrNull('SELECT * FROM swarmy_test.users' + query, ...values) as unknown as UsersRow | null
    }

export async function getOnlyUsersRowOrThrow(
            filter?: Partial<UsersRow>,
            options?: SelectOptions<UsersRow>
        ): Promise<UsersRow> {
        const [query, values] = buildSelect(filter, options)
        return getOnlyRowOrThrow('SELECT * FROM swarmy_test.users' + query, ...values) as unknown as UsersRow
    }

export async function updateApiKeysRow(id: ApiKeysRowId, object: Partial<NewApiKeysRow>, atomicHelper?: {
    key: keyof NewApiKeysRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.apiKeys', id, object, atomicHelper)
    }

export async function updateBeesRow(id: BeesRowId, object: Partial<NewBeesRow>, atomicHelper?: {
    key: keyof NewBeesRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.bees', id, object, atomicHelper)
    }

export async function updateFileReferencesRow(id: FileReferencesRowId, object: Partial<NewFileReferencesRow>, atomicHelper?: {
    key: keyof NewFileReferencesRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.fileReferences', id, object, atomicHelper)
    }

export async function updateOrganizationsRow(id: OrganizationsRowId, object: Partial<NewOrganizationsRow>, atomicHelper?: {
    key: keyof NewOrganizationsRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.organizations', id, object, atomicHelper)
    }

export async function updatePaymentsRow(id: PaymentsRowId, object: Partial<NewPaymentsRow>, atomicHelper?: {
    key: keyof NewPaymentsRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.payments', id, object, atomicHelper)
    }

export async function updatePlansRow(id: PlansRowId, object: Partial<NewPlansRow>, atomicHelper?: {
    key: keyof NewPlansRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.plans', id, object, atomicHelper)
    }

export async function updatePostageCreationQueueRow(id: PostageCreationQueueRowId, object: Partial<NewPostageCreationQueueRow>, atomicHelper?: {
    key: keyof NewPostageCreationQueueRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.postageCreationQueue', id, object, atomicHelper)
    }

export async function updatePostageDiluteQueueRow(id: PostageDiluteQueueRowId, object: Partial<NewPostageDiluteQueueRow>, atomicHelper?: {
    key: keyof NewPostageDiluteQueueRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.postageDiluteQueue', id, object, atomicHelper)
    }

export async function updatePostageTopUpQueueRow(id: PostageTopUpQueueRowId, object: Partial<NewPostageTopUpQueueRow>, atomicHelper?: {
    key: keyof NewPostageTopUpQueueRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.postageTopUpQueue', id, object, atomicHelper)
    }

export async function updateStaticTextsRow(id: StaticTextsRowId, object: Partial<NewStaticTextsRow>, atomicHelper?: {
    key: keyof NewStaticTextsRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.staticTexts', id, object, atomicHelper)
    }

export async function updateUsageMetricsRow(id: UsageMetricsRowId, object: Partial<NewUsageMetricsRow>, atomicHelper?: {
    key: keyof NewUsageMetricsRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.usageMetrics', id, object, atomicHelper)
    }

export async function updateUsersRow(id: UsersRowId, object: Partial<NewUsersRow>, atomicHelper?: {
    key: keyof NewUsersRow
    value: unknown
}): Promise<number> {
    return update('swarmy_test.users', id, object, atomicHelper)
    }

export async function insertApiKeysRow(object: NewApiKeysRow): Promise<ApiKeysRowId> {
        return insert('swarmy_test.apiKeys', object as unknown as Record<string, unknown>) as Promise<ApiKeysRowId>
    }

export async function insertBeesRow(object: NewBeesRow): Promise<BeesRowId> {
        return insert('swarmy_test.bees', object as unknown as Record<string, unknown>) as Promise<BeesRowId>
    }

export async function insertFileReferencesRow(object: NewFileReferencesRow): Promise<FileReferencesRowId> {
        return insert('swarmy_test.fileReferences', object as unknown as Record<string, unknown>) as Promise<FileReferencesRowId>
    }

export async function insertOrganizationsRow(object: NewOrganizationsRow): Promise<OrganizationsRowId> {
        return insert('swarmy_test.organizations', object as unknown as Record<string, unknown>) as Promise<OrganizationsRowId>
    }

export async function insertPaymentsRow(object: NewPaymentsRow): Promise<PaymentsRowId> {
        return insert('swarmy_test.payments', object as unknown as Record<string, unknown>) as Promise<PaymentsRowId>
    }

export async function insertPlansRow(object: NewPlansRow): Promise<PlansRowId> {
        return insert('swarmy_test.plans', object as unknown as Record<string, unknown>) as Promise<PlansRowId>
    }

export async function insertPostageCreationQueueRow(object: NewPostageCreationQueueRow): Promise<PostageCreationQueueRowId> {
        return insert('swarmy_test.postageCreationQueue', object as unknown as Record<string, unknown>) as Promise<PostageCreationQueueRowId>
    }

export async function insertPostageDiluteQueueRow(object: NewPostageDiluteQueueRow): Promise<PostageDiluteQueueRowId> {
        return insert('swarmy_test.postageDiluteQueue', object as unknown as Record<string, unknown>) as Promise<PostageDiluteQueueRowId>
    }

export async function insertPostageTopUpQueueRow(object: NewPostageTopUpQueueRow): Promise<PostageTopUpQueueRowId> {
        return insert('swarmy_test.postageTopUpQueue', object as unknown as Record<string, unknown>) as Promise<PostageTopUpQueueRowId>
    }

export async function insertStaticTextsRow(object: NewStaticTextsRow): Promise<StaticTextsRowId> {
        return insert('swarmy_test.staticTexts', object as unknown as Record<string, unknown>) as Promise<StaticTextsRowId>
    }

export async function insertUsageMetricsRow(object: NewUsageMetricsRow): Promise<UsageMetricsRowId> {
        return insert('swarmy_test.usageMetrics', object as unknown as Record<string, unknown>) as Promise<UsageMetricsRowId>
    }

export async function insertUsersRow(object: NewUsersRow): Promise<UsersRowId> {
        return insert('swarmy_test.users', object as unknown as Record<string, unknown>) as Promise<UsersRowId>
    }


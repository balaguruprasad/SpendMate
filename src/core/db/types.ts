import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const Role = {
    ADMIN: "ADMIN",
    MEMBER: "MEMBER"
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const TxnStatus = {
    PENDING: "PENDING",
    SUBMITTED: "SUBMITTED",
    NO_INVOICE_NEEDED: "NO_INVOICE_NEEDED"
} as const;
export type TxnStatus = (typeof TxnStatus)[keyof typeof TxnStatus];
export const AttachmentEntity = {
    TRANSACTION: "TRANSACTION"
} as const;
export type AttachmentEntity = (typeof AttachmentEntity)[keyof typeof AttachmentEntity];
export type AppSetting = {
    key: string;
    value: unknown;
    updatedAt: Timestamp;
};
export type Attachment = {
    id: Generated<string>;
    entityType: AttachmentEntity;
    entityId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string | null;
    createdAt: Generated<Timestamp>;
};
export type AuditLog = {
    id: Generated<string>;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    metadata: unknown | null;
    createdAt: Generated<Timestamp>;
};
export type Card = {
    id: Generated<string>;
    number: string;
    label: Generated<string>;
    holderId: string;
    remindersOn: Generated<boolean>;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type CardHelper = {
    id: Generated<string>;
    holderId: string;
    helperId: string;
};
export type Notification = {
    id: Generated<string>;
    userId: string;
    type: string;
    title: string;
    body: string | null;
    linkPath: string | null;
    readAt: Timestamp | null;
    createdAt: Generated<Timestamp>;
};
export type RefreshToken = {
    id: Generated<string>;
    userId: string;
    tokenHash: string;
    expiresAt: Timestamp;
    revokedAt: Timestamp | null;
    replacedByTokenId: string | null;
    userAgent: string | null;
    ip: string | null;
    createdAt: Generated<Timestamp>;
};
export type Transaction = {
    id: Generated<string>;
    cardNumber: string;
    cardId: string | null;
    effectiveDate: Timestamp;
    postingDate: Timestamp | null;
    amountPaise: number;
    description: string;
    category: Generated<string>;
    status: Generated<TxnStatus>;
    remarks: Generated<string>;
    invoiceName: Generated<string>;
    invoiceKey: Generated<string>;
    invoiceUrl: Generated<string>;
    /**
     * * Comma-joined values of the configurable Tag dropdown (e.g. Departments).
     */
    tags: Generated<string>;
    /**
     * * Accounts sign-off after the invoice lands: reviewed + accounting done.
     */
    reviewedAt: Timestamp | null;
    reviewedBy: string | null;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type User = {
    id: Generated<string>;
    email: string;
    passwordHash: string;
    name: string;
    role: Generated<Role>;
    /**
     * * Unused in SpendMate; kept nullable so the shared auth core stays as-is.
     */
    departmentId: string | null;
    isActive: Generated<boolean>;
    createdAt: Generated<Timestamp>;
    updatedAt: Timestamp;
};
export type DB = {
    app_settings: AppSetting;
    attachments: Attachment;
    audit_log: AuditLog;
    card_helpers: CardHelper;
    cards: Card;
    notifications: Notification;
    refresh_tokens: RefreshToken;
    transactions: Transaction;
    users: User;
};

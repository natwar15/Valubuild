import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { keptDocuments } from './schema.ts';

export async function keepDocument(params: {
  userId: number;
  userUid: string;
  docType: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
}) {
  const [row] = await db
    .insert(keptDocuments)
    .values({
      ...params,
      docType: params.docType.slice(0, 40),
      fileName: params.fileName.slice(0, 180),
      mimeType: params.mimeType.slice(0, 100),
    })
    .returning({ id: keptDocuments.id, docType: keptDocuments.docType, fileName: keptDocuments.fileName, createdAt: keptDocuments.createdAt });
  return row;
}

/** Metadata only; the file itself is never sent back in a list. */
export async function listKeptDocuments(uid: string) {
  return db
    .select({ id: keptDocuments.id, docType: keptDocuments.docType, fileName: keptDocuments.fileName, createdAt: keptDocuments.createdAt })
    .from(keptDocuments)
    .where(eq(keptDocuments.userUid, uid))
    .orderBy(desc(keptDocuments.createdAt));
}

export async function deleteKeptDocument(uid: string, id: number) {
  const rows = await db
    .delete(keptDocuments)
    .where(and(eq(keptDocuments.userUid, uid), eq(keptDocuments.id, id)))
    .returning({ id: keptDocuments.id });
  return rows.length > 0;
}

import type { RequestHandler } from 'express'
import multer from 'multer'
import { ok, created, noContent } from '../../core/http/response.js'
import { UnprocessableError, ValidationError } from '../../core/errors/index.js'
import type { AttachmentEntity } from '../../core/db/types.js'
import * as service from './attachment.service.js'
import {
  listAttachmentsQuery,
  proxyUploadBody,
  registerAttachmentBody,
  signUploadBody,
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
} from './attachment.schema.js'

type IdParam = { id: string }

/** In-memory multer for single-file `file` field; mime + size enforced here and again in the service. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) return cb(null, true)
    cb(new UnprocessableError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type. Allowed: PDF, PNG, JPEG.'))
  },
})

/** Multer middleware mounted only on the proxy upload route; maps multer errors to our 422s. */
export const uploadMiddleware: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new UnprocessableError('FILE_TOO_LARGE', 'File exceeds the 10 MB limit.'))
      }
      return next(new UnprocessableError('UPLOAD_ERROR', err.message))
    }
    next(err)
  })
}

export const config: RequestHandler = (_req, res) => {
  ok(res, service.getConfig())
}

export const proxyUpload: RequestHandler = async (req, res) => {
  const body = proxyUploadBody.parse(req.body)
  const file = req.file
  if (!file) throw new ValidationError('No file uploaded (expected multipart field "file").')
  const data = await service.proxyUpload(body, {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  })
  ok(res, data)
}

export const sign: RequestHandler = async (req, res) => {
  const body = signUploadBody.parse(req.body)
  ok(res, await service.signUpload(body))
}

export const register: RequestHandler = async (req, res) => {
  const body = registerAttachmentBody.parse(req.body)
  created(res, await service.register(body, req.user!))
}

export const list: RequestHandler = async (req, res) => {
  const query = listAttachmentsQuery.parse(req.query)
  ok(res, await service.list(query.entityType as AttachmentEntity, query.entityId, req.user!))
}

export const download: RequestHandler<IdParam> = async (req, res) => {
  const row = await service.getForDownload(req.params.id, req.user!)
  const redirect = await service.downloadRedirectUrl(row)
  if (redirect) {
    res.redirect(redirect)
    return
  }
  res.setHeader('Content-Type', row.mimeType)
  res.setHeader('Content-Disposition', `inline; filename="${row.fileName.replace(/"/g, '')}"`)
  service.openStream(row).pipe(res)
}

export const remove: RequestHandler<IdParam> = async (req, res) => {
  await service.remove(req.params.id, req.user!)
  noContent(res)
}

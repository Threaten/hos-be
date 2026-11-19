import type { Access, CollectionConfig, Where } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { branchesWhere, hideUnless } from '@/access/permissions'
import type { User } from '@/payload-types'

/** Super admins see everything; others the log of branches where they may read it */
const readLog: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const branches = branchesWhere(user, 'auditLogs', 'read')
  return branches.length ? ({ branches: { in: branches } } as Where) : false
}

const never: Access = () => false

/**
 * Every create, change and delete made by a signed-in person, written by
 * ./plugin.ts. Signing in and out is not recorded. Entries can't be edited
 * or removed by anyone, through the admin or the API.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: { singular: 'Audit log entry', plural: 'Audit log' },
  access: { read: readLog, create: never, update: never, delete: never },
  admin: {
    group: 'People',
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'userName', 'action', 'resource', 'docTitle', 'summary'],
    hidden: hideUnless('auditLogs'),
    description: 'Who created, changed or deleted what, and when. Entries cannot be edited or removed.',
    pagination: { defaultLimit: 50 },
  },
  defaultSort: '-createdAt',
  timestamps: true,
  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Created', value: 'create' },
        { label: 'Changed', value: 'update' },
        { label: 'Deleted', value: 'delete' },
        { label: 'Used voucher', value: 'use' },
      ],
    },
    { name: 'summary', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'resource', label: 'What', type: 'text', index: true, admin: { width: '33%' } },
        { name: 'docTitle', label: 'Record', type: 'text', admin: { width: '33%' } },
        { name: 'docId', label: 'Record ID', type: 'text', index: true, admin: { width: '33%' } },
      ],
    },
    { name: 'collectionSlug', type: 'text', index: true, admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'userName', label: 'By', type: 'text', admin: { width: '50%' } },
        { name: 'user', type: 'relationship', relationTo: 'users', index: true, admin: { width: '50%' } },
      ],
    },
    { name: 'branches', type: 'relationship', relationTo: 'tenants', hasMany: true, index: true },
    {
      name: 'changes',
      type: 'json',
      admin: { description: 'Each changed field, before → after. Long values are shortened; passwords are never stored.' },
    },
  ],
}

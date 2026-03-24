import { Setlist } from '../src/types'

/** Returns true if the request originates from the local machine. */
export function isLocalhost(remoteAddress: string): boolean {
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  )
}

/**
 * Returns true if this client is allowed to mutate the setlist.
 * Only the director (localhost) or users granted explicit edit rights may mutate.
 */
export function canMutate(
  remoteAddress: string,
  userId: string,
  setlist: Setlist,
): boolean {
  if (isLocalhost(remoteAddress)) return true
  if (setlist.directorId === userId) return true
  return setlist.editorIds.includes(userId)
}

/**
 * Returns true if this client is allowed to grant or revoke edit rights.
 * Only the director (must be on localhost) can manage permissions.
 */
export function canManagePermissions(
  remoteAddress: string,
  userId: string,
  setlist: Setlist,
): boolean {
  return isLocalhost(remoteAddress) && setlist.directorId === userId
}

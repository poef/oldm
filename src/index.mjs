import oldmCore from './oldm.mjs'
import * as oldmN3 from './oldm-n3.mjs'

export const oldm = oldmCore
oldm.n3Parser = oldmN3.n3Parser
oldm.n3Writer = oldmN3.n3Writer

window.oldm = oldm

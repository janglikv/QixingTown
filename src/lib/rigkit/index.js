// rigkit 统一导出骨骼定义、骨架、IK 和火柴人渲染相关能力。
export {
  createRigDefinition,
  createRigJointPositions,
} from './definition.js'

export {
  createRigActionController,
  resolveDirectionalControlRotation,
} from './actionController.js'

export {
  createRigContactLocks,
  lockRigContacts,
} from './contactLock.js'

export {
  createRigSkeleton,
  getBoneWorldPosition,
  localJointsToWorldJoints,
  readSkeletonJointPositions,
  worldToFigureLocal,
} from './skeleton.js'

export {
  applyTwoBoneIk,
  applyTwoBoneIkWorld,
  solveTwoBoneIk,
} from './twoBoneIk.js'

export {
  attachRigRuntimeUpdate,
} from './runtime.js'

export {
  createRigFigure,
} from './figureRuntime.js'

export {
  createStickFigureRig,
  disposeStickFigureRig,
  syncStickFigureRigPose,
} from './stickFigureRenderer.js'

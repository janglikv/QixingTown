// 提供 rig 每帧姿态管线：运行外部姿态更新、锁定支撑点，并同步骨架到可见渲染。
import { lockRigContacts } from './contactLock.js'
import { readSkeletonJointPositions } from './skeleton.js'
import { syncStickFigureRigPose } from './stickFigureRenderer.js'

export const attachRigRuntimeUpdate = ({
  rig,
  figure,
  bones,
  skeletonRoot,
  updatePose,
}) => {
  figure.userData.update = (delta) => {
    const poseUpdate = updatePose?.(delta)
    poseUpdate?.reapplyIk?.()
    lockRigContacts({
      rig,
      figure,
      bones,
      skeletonRoot,
      contactLocks: figure.userData.contactLocks,
      lockedContactKeys: figure.userData.lockedContactKeys,
    })

    const joints = readSkeletonJointPositions({ rig, figure, bones })
    syncStickFigureRigPose({ figure, joints })
  }
}

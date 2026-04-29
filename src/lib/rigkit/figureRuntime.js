// 提供把 rig definition 装配成可运行 figure 的通用工厂，包含骨架、渲染、支撑锁和姿态同步。
import { createRigActionController } from './actionController.js'
import { createRigContactLocks } from './contactLock.js'
import { attachRigRuntimeUpdate } from './runtime.js'
import {
  createRigSkeleton,
  readSkeletonJointPositions,
} from './skeleton.js'
import {
  createStickFigureRig,
  disposeStickFigureRig,
  syncStickFigureRigPose,
} from './stickFigureRenderer.js'

export const createRigFigure = ({
  name,
  position,
  rig,
  joints,
  render = rig.definition.render,
  actions = null,
}) => {
  const skeleton = createRigSkeleton({ rig, joints })
  const figure = createStickFigureRig({
    name,
    position,
    joints,
    rig,
    render,
  })

  figure.add(skeleton.root)
  figure.userData.skeletonRoot = skeleton.root
  figure.userData.bones = skeleton.bones
  figure.updateMatrixWorld(true)
  figure.userData.contactLocks = createRigContactLocks({
    figure,
    joints,
    contactKeys: rig.supportContactKeys,
  })
  figure.userData.lockedContactKeys = rig.supportContactKeys
  figure.userData.setControlPointsVisible = (visible) => {
    figure.userData.controlPointGroup.visible = visible
  }
  figure.userData.syncPose = () => {
    syncStickFigureRigPose({
      figure,
      joints: readSkeletonJointPositions({
        rig,
        figure,
        bones: skeleton.bones,
      }),
    })
  }
  const actionOptions = actions === true ? {} : actions
  const userAction = actionOptions
    ? createRigActionController({
      figure,
      bones: skeleton.bones,
      controlGroupsByKey: actionOptions.controlGroupsByKey ?? rig.controlGroupsByKey,
      ikChainsByKey: actionOptions.ikChainsByKey ?? rig.ikChainsByKey,
      resolveControlRotation: actionOptions.resolveControlRotation,
      transitionDuration: actionOptions.transitionDuration,
    })
    : null
  if (userAction) {
    figure.userData.playUserAction = (action) => {
      userAction.play(action)
    }
    figure.userData.previewUserAction = (action) => {
      userAction.preview(action)
    }
    figure.userData.cancelUserAction = () => {
      userAction.cancel()
    }
  }
  attachRigRuntimeUpdate({
    rig,
    figure,
    bones: skeleton.bones,
    skeletonRoot: skeleton.root,
    updatePose: userAction?.update,
  })

  figure.userData.dispose = () => {
    disposeStickFigureRig(figure)
  }

  return {
    figure,
    skeleton,
  }
}

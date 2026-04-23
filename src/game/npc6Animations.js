import {
  AnimationClip,
  NumberKeyframeTrack,
} from 'three'

const SQUAT_CLIP_DURATION = 1.4

export const createNpc6SquatClip = (joints) => {
  const times = [0, SQUAT_CLIP_DURATION / 2, SQUAT_CLIP_DURATION]
  const neckOffset = joints.neck.clone().sub(joints.hip)

  return new AnimationClip('npc6-squat-stand', SQUAT_CLIP_DURATION, [
    // neck 是躯干顶点；只前移不下移，让躯干前倾但保持肩颈高度。
    new NumberKeyframeTrack('neck.position[z]', times, [neckOffset.z, neckOffset.z + 0.28, neckOffset.z]),
    new NumberKeyframeTrack('hipLeft.rotation[x]', times, [0, -1.3, 0]),
    new NumberKeyframeTrack('kneeLeft.rotation[x]', times, [0, 1.85, 0]),
    new NumberKeyframeTrack('hipRight.rotation[x]', times, [0, -1.3, 0]),
    new NumberKeyframeTrack('kneeRight.rotation[x]', times, [0, 1.85, 0]),
  ])
}

export const createNpc6AnimationClips = (joints) => ({
  squat: createNpc6SquatClip(joints),
})

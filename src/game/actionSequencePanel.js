import { readUserActions, serializeActions } from './actionSettingsPanel.js'

const ACTION_SEQUENCES_STORAGE_KEY = 'qixing-town:action-sequences'
const PANEL_STATE_STORAGE_KEY = 'qixing-town:action-sequence-panel'
const DEFAULT_ACTION_STEP_DURATION = 0.9
const POSITION_AXIS_OPTIONS = [
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
  { value: 'z', label: 'Z' },
]

const createId = () => `action-sequence-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const normalizeStep = (step) => {
  if (typeof step?.id !== 'string') return null
  if (step?.type === 'delay') {
    return {
      id: step.id,
      type: 'delay',
      targetId: '',
      repeat: 1,
      duration: Number.isFinite(step.duration) ? step.duration : DEFAULT_ACTION_STEP_DURATION,
    }
  }

  if (step?.type === 'position') {
    const axis = ['x', 'y', 'z'].includes(step.axis)
      ? step.axis
      : ['x', 'y', 'z'].includes(step.targetId)
        ? step.targetId
        : 'y'

    return {
      id: step.id,
      type: 'position',
      targetId: axis,
      axis,
      amount: Number.isFinite(step.amount) ? step.amount : 0,
      repeat: 1,
      duration: Number.isFinite(step.duration) ? step.duration : DEFAULT_ACTION_STEP_DURATION,
    }
  }

  if (typeof step?.type === 'string' && typeof step?.targetId === 'string') {
    return {
      ...step,
      type: step.type === 'sequence' ? 'sequence' : 'action',
      repeat: step.type === 'sequence' && Number.isFinite(step.repeat) ? step.repeat : 1,
      duration: step.type === 'action' && Number.isFinite(step.duration)
        ? step.duration
        : DEFAULT_ACTION_STEP_DURATION,
    }
  }

  return typeof step?.actionId === 'string'
    ? {
      id: step.id,
      type: 'action',
      targetId: step.actionId,
      repeat: 1,
      duration: DEFAULT_ACTION_STEP_DURATION,
    }
    : null
}

const normalizeSteps = (steps) => (
  Array.isArray(steps)
    ? steps.map(normalizeStep).filter(Boolean)
    : []
)

const createLegacyTrack = (sequence) => ({
  id: `${sequence.id}-track-main`,
  label: '主轨道',
  loop: sequence.loop === true,
  steps: normalizeSteps(sequence.steps),
})

export const normalizeActionSequence = (sequence) => {
  const tracks = Array.isArray(sequence.tracks) && sequence.tracks.length > 0
    ? sequence.tracks.filter((track) => typeof track?.id === 'string').map((track, index) => ({
      id: track.id,
      label: typeof track.label === 'string' && track.label.trim()
        ? track.label
        : `轨道 ${index + 1}`,
      loop: track.loop === true,
      steps: normalizeSteps(track.steps),
    }))
    : [createLegacyTrack(sequence)]

  return {
    ...sequence,
    loop: sequence.loop === true,
    steps: tracks[0]?.steps ?? [],
    tracks,
  }
}

export const readUserActionSequences = () => {
  try {
    const sequences = JSON.parse(window.localStorage.getItem(ACTION_SEQUENCES_STORAGE_KEY))

    if (!Array.isArray(sequences)) return []

    return sequences.filter((sequence) => (
      typeof sequence?.id === 'string'
      && typeof sequence?.label === 'string'
    )).map(normalizeActionSequence)
  } catch {
    return []
  }
}

const writeSequences = (sequences) => {
  try {
    window.localStorage.setItem(ACTION_SEQUENCES_STORAGE_KEY, JSON.stringify(sequences))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readPanelState = () => {
  try {
    const state = JSON.parse(window.localStorage.getItem(PANEL_STATE_STORAGE_KEY))

    return {
      visible: state?.visible === true,
      selectedId: typeof state?.selectedId === 'string' ? state.selectedId : null,
    }
  } catch {
    return {
      visible: false,
      selectedId: null,
    }
  }
}

const writePanelState = ({ visible, selectedId }) => {
  try {
    window.localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify({ visible, selectedId }))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const applyButtonStyle = (button, variant = 'normal') => {
  Object.assign(button.style, {
    height: '30px',
    padding: '0 10px',
    border: '1px solid rgba(238, 245, 238, 0.24)',
    borderRadius: '5px',
    background: variant === 'danger' ? 'rgba(160, 38, 38, 0.82)' : 'rgba(238, 245, 238, 0.1)',
    color: '#eef5ee',
    font: 'inherit',
    cursor: 'pointer',
  })
}

const createTextInput = () => {
  const input = document.createElement('input')

  Object.assign(input.style, {
    width: '100%',
    height: '30px',
    padding: '0 8px',
    border: '1px solid rgba(238, 245, 238, 0.24)',
    borderRadius: '5px',
    background: 'rgba(7, 17, 31, 0.88)',
    color: '#eef5ee',
    font: 'inherit',
  })

  return input
}

const createSelectInput = (options) => {
  const select = document.createElement('select')

  options.forEach((option) => {
    const item = document.createElement('option')
    item.value = option.value
    item.textContent = option.label
    select.append(item)
  })

  Object.assign(select.style, {
    width: '100%',
    height: '30px',
    padding: '0 8px',
    border: '1px solid rgba(238, 245, 238, 0.24)',
    borderRadius: '5px',
    background: 'rgba(7, 17, 31, 0.88)',
    color: '#eef5ee',
    font: 'inherit',
  })

  return select
}

const createField = ({ label, input }) => {
  const field = document.createElement('label')
  const text = document.createElement('span')

  text.textContent = label
  Object.assign(field.style, {
    display: 'grid',
    gap: '6px',
    fontSize: '13px',
  })
  Object.assign(text.style, {
    color: 'rgba(238, 245, 238, 0.72)',
  })
  field.append(text, input)

  return field
}

export const createActionSequencePanel = ({ app }) => {
  let sequences = readUserActionSequences()
  const initialPanelState = readPanelState()
  let selectedId = sequences.some((sequence) => sequence.id === initialPanelState.selectedId)
    ? initialPanelState.selectedId
    : null
  let visible = initialPanelState.visible
  let lastCursorVisible = null
  let draftTracks = []
  let selectedTrackId = null

  const button = document.createElement('button')
  const panel = document.createElement('section')
  const detailPanel = document.createElement('section')
  const list = document.createElement('div')
  const emptyText = document.createElement('div')
  const nameInput = createTextInput()
  const loopInput = document.createElement('input')
  const trackNameInput = createTextInput()
  const trackLoopInput = document.createElement('input')
  const trackList = document.createElement('div')
  const emptyTrackText = document.createElement('div')
  const stepList = document.createElement('div')
  const emptyStepText = document.createElement('div')
  const addButton = document.createElement('button')
  const importButton = document.createElement('button')
  const addTrackButton = document.createElement('button')
  const deleteTrackButton = document.createElement('button')
  const addStepButton = document.createElement('button')
  const exportButton = document.createElement('button')
  const saveButton = document.createElement('button')
  const deleteButton = document.createElement('button')

  const getActionOptions = () => readUserActions().map((action) => ({
    value: action.id,
    label: action.label,
  }))

  const getSequenceOptions = () => sequences
    .filter((sequence) => sequence.id !== selectedId)
    .map((sequence) => ({
      value: sequence.id,
      label: sequence.label,
    }))

  const getTargetOptions = (type) => (
    type === 'sequence'
      ? getSequenceOptions()
      : type === 'delay'
        ? []
        : type === 'position'
          ? POSITION_AXIS_OPTIONS
          : getActionOptions()
  )

  const getSelectedSequence = () => sequences.find((sequence) => sequence.id === selectedId) ?? null
  const getSelectedTrack = () => draftTracks.find((track) => track.id === selectedTrackId) ?? null

  const updateSelectedTrack = (patch) => {
    draftTracks = draftTracks.map((track) => (
      track.id === selectedTrackId ? { ...track, ...patch } : track
    ))
  }

  const setSelectedTrackSteps = (steps) => {
    updateSelectedTrack({ steps })
  }

  const persistPanelState = () => {
    writePanelState({ visible, selectedId })
  }

  const handleToggle = () => {
    visible = !visible
    panel.style.display = visible ? 'block' : 'none'
    persistPanelState()
    syncForm()
  }

  const handleDetailClose = () => {
    const sequence = getSelectedSequence()

    if (sequence && draftTracks.length === 0) {
      sequences = sequences.filter((item) => item.id !== sequence.id)
      selectedId = null
      selectedTrackId = null
      persistAndRender()
      return
    }

    selectedId = null
    selectedTrackId = null
    persistPanelState()
    renderList()
    syncForm()
  }

  const createCloseButton = (onClick) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = '&times;'
    Object.assign(btn.style, {
      position: 'absolute',
      right: '8px',
      top: '8px',
      width: '24px',
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      borderRadius: '4px',
      background: 'transparent',
      color: '#ff4d4f',
      fontSize: '20px',
      cursor: 'pointer',
      lineHeight: '1',
      zIndex: '12',
    })
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 77, 79, 0.1)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent'
    })
    btn.addEventListener('click', onClick)
    return btn
  }

  button.textContent = '动作序列'
  applyButtonStyle(button)
  Object.assign(button.style, {
    position: 'absolute',
    right: '14px',
    top: '116px',
    zIndex: '10',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    padding: '0px 12px',
  })

  ;[panel, detailPanel].forEach((element) => {
    Object.assign(element.style, {
      position: 'absolute',
      right: '14px',
      top: '16px',
      zIndex: element === panel ? '11' : '12',
      display: 'none',
      width: element === panel ? '360px' : '520px',
      maxWidth: 'calc(100vw - 28px)',
      padding: '12px',
      border: '1px solid rgba(238, 245, 238, 0.18)',
      borderRadius: '8px',
      background: '#07111f',
      color: '#eef5ee',
      fontSize: '14px',
      userSelect: 'none',
    })
  })

  const title = document.createElement('div')
  title.textContent = '动作序列'
  Object.assign(title.style, {
    marginBottom: '10px',
    fontSize: '15px',
    fontWeight: '600',
  })

  Object.assign(list.style, {
    display: 'grid',
    gap: '6px',
    marginBottom: '12px',
  })

  emptyText.textContent = '暂无动作序列'
  Object.assign(emptyText.style, {
    display: 'none',
    padding: '12px',
    border: '1px dashed rgba(238, 245, 238, 0.2)',
    borderRadius: '6px',
    color: 'rgba(238, 245, 238, 0.62)',
    textAlign: 'center',
  })

  const detailTitle = document.createElement('div')
  detailTitle.textContent = '序列详情'
  Object.assign(detailTitle.style, {
    marginBottom: '10px',
    fontSize: '15px',
    fontWeight: '600',
  })

  loopInput.type = 'checkbox'
  loopInput.style.margin = '0'
  const loopField = document.createElement('label')
  Object.assign(loopField.style, {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '13px',
    color: 'rgba(238, 245, 238, 0.72)',
  })
  loopField.append(loopInput, document.createTextNode('循环播放'))

  trackLoopInput.type = 'checkbox'
  trackLoopInput.style.margin = '0'
  const trackLoopField = document.createElement('label')
  Object.assign(trackLoopField.style, {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '13px',
    color: 'rgba(238, 245, 238, 0.72)',
  })
  trackLoopField.append(trackLoopInput, document.createTextNode('轨道循环'))

  const form = document.createElement('div')
  Object.assign(form.style, {
    display: 'grid',
    gap: '10px',
  })
  form.append(
    createField({ label: '序列名称', input: nameInput }),
    loopField,
  )

  const trackTitle = document.createElement('div')
  trackTitle.textContent = '播放轨道'
  Object.assign(trackTitle.style, {
    marginTop: '12px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
  })

  Object.assign(trackList.style, {
    display: 'grid',
    gap: '6px',
    maxHeight: '120px',
    overflowY: 'auto',
  })

  emptyTrackText.textContent = '暂无播放轨道'
  Object.assign(emptyTrackText.style, {
    display: 'none',
    padding: '10px',
    border: '1px dashed rgba(238, 245, 238, 0.2)',
    borderRadius: '6px',
    color: 'rgba(238, 245, 238, 0.62)',
    textAlign: 'center',
  })

  const trackForm = document.createElement('div')
  Object.assign(trackForm.style, {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '10px',
    alignItems: 'end',
    marginTop: '8px',
  })
  trackForm.append(
    createField({ label: '轨道名称', input: trackNameInput }),
    trackLoopField,
  )

  const stepTitle = document.createElement('div')
  stepTitle.textContent = '播放步骤'
  Object.assign(stepTitle.style, {
    marginTop: '12px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
  })

  const stepHeader = document.createElement('div')
  stepHeader.replaceChildren(...['类型', '目标', '时长', '重复/距离', '排序', ''].map((label) => {
    const item = document.createElement('span')
    item.textContent = label
    Object.assign(item.style, {
      color: 'rgba(238, 245, 238, 0.62)',
      fontSize: '12px',
    })
    return item
  }))
  Object.assign(stepHeader.style, {
    display: 'grid',
    gridTemplateColumns: '72px 1fr 72px 72px 96px 52px',
    gap: '8px',
    marginBottom: '6px',
  })

  Object.assign(stepList.style, {
    display: 'grid',
    gap: '8px',
    maxHeight: '220px',
    overflowY: 'auto',
  })

  emptyStepText.textContent = '暂无播放步骤'
  Object.assign(emptyStepText.style, {
    display: 'none',
    padding: '10px',
    border: '1px dashed rgba(238, 245, 238, 0.2)',
    borderRadius: '6px',
    color: 'rgba(238, 245, 238, 0.62)',
    textAlign: 'center',
  })

  addButton.type = 'button'
  importButton.type = 'button'
  addTrackButton.type = 'button'
  deleteTrackButton.type = 'button'
  addStepButton.type = 'button'
  exportButton.type = 'button'
  saveButton.type = 'button'
  deleteButton.type = 'button'
  addButton.textContent = '新增'
  importButton.textContent = '导入'
  addTrackButton.textContent = '新增轨道'
  deleteTrackButton.textContent = '删除轨道'
  addStepButton.textContent = '新增步骤'
  exportButton.textContent = '导出'
  saveButton.textContent = '保存'
  deleteButton.textContent = '删除'
  applyButtonStyle(addButton)
  applyButtonStyle(importButton)
  applyButtonStyle(addTrackButton)
  applyButtonStyle(deleteTrackButton, 'danger')
  applyButtonStyle(addStepButton)
  applyButtonStyle(exportButton)
  applyButtonStyle(saveButton)
  applyButtonStyle(deleteButton, 'danger')
  Object.assign(addButton.style, {
    flex: '1',
    borderStyle: 'dashed',
  })
  Object.assign(importButton.style, {
    flex: '1',
    borderStyle: 'dashed',
  })
  Object.assign(addStepButton.style, {
    width: '100%',
    borderStyle: 'dashed',
  })
  Object.assign(addTrackButton.style, {
    flex: '1',
    borderStyle: 'dashed',
  })
  Object.assign(deleteTrackButton.style, {
    flex: '1',
  })

  const addBar = document.createElement('div')
  Object.assign(addBar.style, {
    display: 'flex',
    gap: '8px',
    width: '100%',
    marginTop: '12px',
  })
  addBar.append(addButton, importButton)

  const trackBar = document.createElement('div')
  Object.assign(trackBar.style, {
    display: 'flex',
    gap: '8px',
    width: '100%',
    marginTop: '8px',
  })
  trackBar.append(addTrackButton, deleteTrackButton)

  const stepBar = document.createElement('div')
  Object.assign(stepBar.style, {
    display: 'flex',
    width: '100%',
    marginTop: '8px',
  })
  stepBar.append(addStepButton)

  const actionsBar = document.createElement('div')
  const saveGroup = document.createElement('div')
  Object.assign(actionsBar.style, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '12px',
  })
  Object.assign(saveGroup.style, {
    display: 'flex',
    gap: '8px',
  })
  saveGroup.append(exportButton, saveButton)
  actionsBar.append(deleteButton, saveGroup)

  panel.append(createCloseButton(handleToggle), title, list, emptyText, addBar)
  detailPanel.append(
    createCloseButton(handleDetailClose),
    detailTitle,
    form,
    trackTitle,
    trackList,
    emptyTrackText,
    trackBar,
    trackForm,
    stepTitle,
    stepHeader,
    stepList,
    emptyStepText,
    stepBar,
    actionsBar,
  )
  app.append(button, panel, detailPanel)

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }

  const renderTrackList = () => {
    trackList.replaceChildren()
    emptyTrackText.style.display = draftTracks.length === 0 ? 'block' : 'none'
    deleteTrackButton.disabled = draftTracks.length <= 1

    draftTracks.forEach((track, index) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.textContent = track.label || `轨道 ${index + 1}`
      applyButtonStyle(item)
      Object.assign(item.style, {
        width: '100%',
        textAlign: 'left',
        background: track.id === selectedTrackId ? 'rgba(83, 127, 214, 0.42)' : 'rgba(238, 245, 238, 0.08)',
      })
      item.addEventListener('click', () => {
        selectedTrackId = track.id
        renderTrackList()
        syncTrackForm()
        renderStepList()
      })
      trackList.append(item)
    })
  }

  const syncTrackForm = () => {
    const track = getSelectedTrack()
    const disabled = !track

    trackNameInput.disabled = disabled
    trackLoopInput.disabled = disabled
    addStepButton.disabled = disabled
    deleteTrackButton.disabled = disabled || draftTracks.length <= 1
    trackNameInput.value = track?.label ?? ''
    trackLoopInput.checked = track?.loop === true
  }

  const renderStepList = () => {
    const actionOptions = getActionOptions()
    const sequenceOptions = getSequenceOptions()
    const track = getSelectedTrack()
    const draftSteps = track?.steps ?? []
    const canAddStep = !!track

    stepList.replaceChildren()
    emptyStepText.style.display = draftSteps.length === 0 ? 'block' : 'none'
    addStepButton.disabled = !canAddStep

    draftSteps.forEach((step, index) => {
      const row = document.createElement('div')
      const typeSelect = createSelectInput([
        { value: 'action', label: '动作' },
        { value: 'sequence', label: '序列' },
        { value: 'position', label: '位移' },
        { value: 'delay', label: '延迟' },
      ])
      const targetOptions = getTargetOptions(step.type)
      const targetSelect = createSelectInput(targetOptions)
      const durationInput = createTextInput()
      const repeatInput = createTextInput()
      const moveGroup = document.createElement('div')
      const moveUpButton = document.createElement('button')
      const moveDownButton = document.createElement('button')
      const removeButton = document.createElement('button')

      typeSelect.value = step.type === 'sequence'
        ? 'sequence'
        : step.type === 'position'
          ? 'position'
          : step.type === 'delay'
            ? 'delay'
            : 'action'
      targetSelect.value = targetOptions.some((option) => option.value === step.targetId)
        ? step.targetId
        : targetOptions[0]?.value ?? ''
      targetSelect.disabled = step.type === 'delay'
      durationInput.type = 'number'
      durationInput.min = '0'
      durationInput.step = '0.1'
      durationInput.value = step.type === 'action' || step.type === 'delay' || step.type === 'position'
        ? String(step.duration ?? DEFAULT_ACTION_STEP_DURATION)
        : ''
      durationInput.disabled = step.type === 'sequence'
      repeatInput.type = 'number'
      repeatInput.min = step.type === 'position' ? '-99' : '1'
      repeatInput.step = step.type === 'position' ? '0.1' : '1'
      repeatInput.value = step.type === 'sequence'
        ? String(step.repeat)
        : step.type === 'position'
          ? String(step.amount ?? 0)
          : ''
      repeatInput.disabled = step.type !== 'sequence' && step.type !== 'position'
      moveUpButton.type = 'button'
      moveDownButton.type = 'button'
      moveUpButton.textContent = '上移'
      moveDownButton.textContent = '下移'
      moveUpButton.disabled = index === 0
      moveDownButton.disabled = index === draftSteps.length - 1
      removeButton.type = 'button'
      removeButton.textContent = '删除'
      applyButtonStyle(moveUpButton)
      applyButtonStyle(moveDownButton)
      applyButtonStyle(removeButton, 'danger')
      Object.assign(moveGroup.style, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
      })
      Object.assign(moveUpButton.style, {
        padding: '0 6px',
      })
      Object.assign(moveDownButton.style, {
        padding: '0 6px',
      })
      Object.assign(row.style, {
        display: 'grid',
        gridTemplateColumns: '72px 1fr 72px 72px 96px 52px',
        gap: '8px',
        alignItems: 'center',
      })

      typeSelect.addEventListener('change', () => {
        const type = typeSelect.value === 'sequence'
          ? 'sequence'
          : typeSelect.value === 'position'
            ? 'position'
            : typeSelect.value === 'delay'
              ? 'delay'
              : 'action'
        const options = getTargetOptions(type)

        const nextSteps = draftSteps.map((item) => (
          item.id === step.id
            ? {
              ...item,
              type,
              targetId: options[0]?.value ?? '',
              axis: type === 'position' ? options[0]?.value ?? 'y' : undefined,
              amount: type === 'position' ? 0 : undefined,
              repeat: 1,
              duration: type === 'sequence' ? 0 : DEFAULT_ACTION_STEP_DURATION,
            }
            : item
        ))
        setSelectedTrackSteps(nextSteps)
        renderStepList()
      })
      targetSelect.addEventListener('change', () => {
        const nextSteps = draftSteps.map((item) => (
          item.id === step.id
            ? {
              ...item,
              targetId: targetSelect.value,
              axis: item.type === 'position' ? targetSelect.value : item.axis,
            }
            : item
        ))
        setSelectedTrackSteps(nextSteps)
      })
      durationInput.addEventListener('input', () => {
        const nextSteps = draftSteps.map((item) => (
          item.id === step.id ? { ...item, duration: Number(durationInput.value) } : item
        ))
        setSelectedTrackSteps(nextSteps)
      })
      repeatInput.addEventListener('input', () => {
        const nextSteps = draftSteps.map((item) => (
          item.id === step.id
            ? item.type === 'position'
              ? { ...item, amount: Number(repeatInput.value) }
              : { ...item, repeat: Number(repeatInput.value) }
            : item
        ))
        setSelectedTrackSteps(nextSteps)
      })
      moveUpButton.addEventListener('click', () => {
        if (index === 0) return

        const nextSteps = [...draftSteps]
        ;[nextSteps[index - 1], nextSteps[index]] = [nextSteps[index], nextSteps[index - 1]]
        setSelectedTrackSteps(nextSteps)
        renderStepList()
      })
      moveDownButton.addEventListener('click', () => {
        if (index >= draftSteps.length - 1) return

        const nextSteps = [...draftSteps]
        ;[nextSteps[index], nextSteps[index + 1]] = [nextSteps[index + 1], nextSteps[index]]
        setSelectedTrackSteps(nextSteps)
        renderStepList()
      })
      removeButton.addEventListener('click', () => {
        setSelectedTrackSteps(draftSteps.filter((item) => item.id !== step.id))
        renderStepList()
      })

      moveGroup.append(moveUpButton, moveDownButton)
      row.append(typeSelect, targetSelect, durationInput, repeatInput, moveGroup, removeButton)
      stepList.append(row)
    })
  }

  const syncForm = () => {
    const sequence = getSelectedSequence()
    const disabled = !sequence

    panel.style.display = visible && !sequence ? 'block' : 'none'
    detailPanel.style.display = visible && sequence ? 'block' : 'none'
    nameInput.disabled = disabled
    loopInput.disabled = disabled
    exportButton.disabled = disabled
    saveButton.disabled = disabled
    deleteButton.disabled = disabled
    nameInput.value = sequence?.label ?? ''
    loopInput.checked = sequence?.loop === true
    draftTracks = Array.isArray(sequence?.tracks)
      ? sequence.tracks.map((track) => ({
        ...track,
        steps: Array.isArray(track.steps) ? track.steps.map((step) => ({ ...step })) : [],
      }))
      : []
    selectedTrackId = draftTracks.some((track) => track.id === selectedTrackId)
      ? selectedTrackId
      : draftTracks[0]?.id ?? null
    renderTrackList()
    syncTrackForm()
    renderStepList()
  }

  const renderList = () => {
    list.replaceChildren()
    emptyText.style.display = sequences.length === 0 ? 'block' : 'none'

    sequences.forEach((sequence) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.textContent = sequence.label
      applyButtonStyle(item)
      Object.assign(item.style, {
        width: '100%',
        textAlign: 'left',
        background: sequence.id === selectedId ? 'rgba(83, 127, 214, 0.42)' : 'rgba(238, 245, 238, 0.08)',
      })
      item.addEventListener('click', () => {
        selectedId = sequence.id
        persistPanelState()
        renderList()
        syncForm()
      })
      list.append(item)
    })
  }

  const persistAndRender = () => {
    writeSequences(sequences)
    app.dispatchEvent(new CustomEvent('qixing-town:action-sequences-changed'))
    if (!sequences.some((sequence) => sequence.id === selectedId)) {
      selectedId = null
    }
    persistPanelState()
    renderList()
    syncForm()
  }

  const handleAdd = () => {
    const actionId = getActionOptions()[0]?.value
    const track = {
      id: createId(),
      label: '主轨道',
      loop: false,
      steps: actionId
        ? [{
          id: createId(),
          type: 'action',
          targetId: actionId,
          repeat: 1,
          duration: DEFAULT_ACTION_STEP_DURATION,
        }]
        : [],
    }
    const nextSequence = {
      id: createId(),
      label: `新序列 ${sequences.length + 1}`,
      loop: false,
      steps: track.steps,
      tracks: [track],
    }

    sequences = [...sequences, nextSequence]
    selectedId = nextSequence.id
    selectedTrackId = track.id
    persistAndRender()
  }

  const handleAddTrack = () => {
    const nextTrack = {
      id: createId(),
      label: `轨道 ${draftTracks.length + 1}`,
      loop: loopInput.checked,
      steps: [],
    }

    draftTracks = [...draftTracks, nextTrack]
    selectedTrackId = nextTrack.id
    renderTrackList()
    syncTrackForm()
    renderStepList()
  }

  const handleDeleteTrack = () => {
    if (draftTracks.length <= 1 || !selectedTrackId) return

    const index = draftTracks.findIndex((track) => track.id === selectedTrackId)
    draftTracks = draftTracks.filter((track) => track.id !== selectedTrackId)
    selectedTrackId = draftTracks[Math.max(0, index - 1)]?.id ?? draftTracks[0]?.id ?? null
    renderTrackList()
    syncTrackForm()
    renderStepList()
  }

  const handleAddStep = () => {
    const actionId = getActionOptions()[0]?.value
    const sequenceId = getSequenceOptions()[0]?.value
    const type = actionId ? 'action' : sequenceId ? 'sequence' : 'delay'
    const track = getSelectedTrack()
    if (!track) return

    setSelectedTrackSteps([
      ...track.steps,
      {
        id: createId(),
        type,
        targetId: type === 'action' ? actionId : type === 'sequence' ? sequenceId : '',
        repeat: 1,
        duration: type === 'sequence' ? 0 : DEFAULT_ACTION_STEP_DURATION,
      },
    ])
    renderStepList()
  }

  const createDraftSequence = () => {
    const sequence = getSelectedSequence()
    if (!sequence) return null

    const label = nameInput.value.trim()
    if (!label) return null
    const actionIds = new Set(getActionOptions().map((option) => option.value))
    const sequenceIds = new Set(getSequenceOptions().map((option) => option.value))
    const normalizeDraftSteps = (steps) => steps.filter((step) => (
      (
        step.type === 'action'
        && actionIds.has(step.targetId)
        && Number.isFinite(step.duration)
        && step.duration >= 0
      )
      || (
        step.type === 'sequence'
        && sequenceIds.has(step.targetId)
        && Number.isFinite(step.repeat)
        && step.repeat >= 1
      )
      || (
        step.type === 'delay'
        && Number.isFinite(step.duration)
        && step.duration >= 0
      )
      || (
        step.type === 'position'
        && ['x', 'y', 'z'].includes(step.axis ?? step.targetId)
        && Number.isFinite(step.amount)
        && Number.isFinite(step.duration)
        && step.duration >= 0
      )
    )).map((step) => ({
      id: step.id,
      type: step.type === 'sequence'
        ? 'sequence'
        : step.type === 'delay'
          ? 'delay'
          : step.type === 'position'
            ? 'position'
            : 'action',
      targetId: step.type === 'position' ? step.axis ?? step.targetId : step.targetId,
      axis: step.type === 'position' ? step.axis ?? step.targetId : undefined,
      amount: step.type === 'position' ? step.amount : undefined,
      repeat: step.type === 'sequence' ? Math.floor(step.repeat) : 1,
      duration: step.type === 'sequence' ? 0 : step.duration,
    }))
    const tracks = draftTracks.map((track, index) => ({
      id: track.id,
      label: typeof track.label === 'string' && track.label.trim()
        ? track.label.trim()
        : `轨道 ${index + 1}`,
      loop: track.loop === true,
      steps: normalizeDraftSteps(track.steps),
    })).filter((track, index) => index === 0 || track.steps.length > 0)
    if (tracks.length === 0) return null

    return {
      ...sequence,
      label,
      loop: loopInput.checked,
      steps: tracks[0].steps,
      tracks,
    }
  }

  const handleSave = () => {
    const sequence = getSelectedSequence()
    const draftSequence = createDraftSequence()
    if (!sequence || !draftSequence) return

    sequences = sequences.map((item) => (
      item.id === sequence.id ? draftSequence : item
    ))
    persistAndRender()
  }

  const collectExportSequences = (rootSequence) => {
    const collectedSequences = []
    const actionIds = new Set()
    const sequencesById = new Map(sequences.map((sequence) => [sequence.id, sequence]))
    const getSequenceSteps = (sequence) => (
      Array.isArray(sequence.tracks) && sequence.tracks.length > 0
        ? sequence.tracks.flatMap((track) => track.steps || [])
        : sequence.steps || []
    )
    const visitSequence = (sequence) => {
      if (!sequence || collectedSequences.some((item) => item.id === sequence.id)) return

      collectedSequences.push(sequence)
      getSequenceSteps(sequence).forEach((step) => {
        if (step.type === 'action') {
          actionIds.add(step.targetId)
          return
        }

        if (step.type === 'sequence') {
          visitSequence(sequencesById.get(step.targetId))
        }
      })
    }

    sequencesById.set(rootSequence.id, rootSequence)
    visitSequence(rootSequence)

    return {
      sequences: collectedSequences,
      actions: readUserActions().filter((action) => actionIds.has(action.id)),
    }
  }

  const showJsonModal = (title, json) => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
    })

    const modal = document.createElement('div')
    Object.assign(modal.style, {
      width: '80%',
      height: '80%',
      background: '#07111f',
      border: '1px solid rgba(238, 245, 238, 0.24)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    })

    const header = document.createElement('div')
    header.textContent = title
    Object.assign(header.style, {
      fontSize: '16px',
      fontWeight: '600',
      color: '#eef5ee',
    })

    const textarea = document.createElement('textarea')
    textarea.value = json
    textarea.readOnly = true
    Object.assign(textarea.style, {
      flex: '1',
      background: 'rgba(7, 17, 31, 0.88)',
      color: '#eef5ee',
      border: '1px solid rgba(238, 245, 238, 0.24)',
      borderRadius: '4px',
      padding: '12px',
      fontFamily: 'monospace',
      fontSize: '13px',
      resize: 'none',
      whiteSpace: 'pre',
    })

    const footer = document.createElement('div')
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
    })

    const copyBtn = document.createElement('button')
    copyBtn.textContent = '复制到剪贴板'
    applyButtonStyle(copyBtn)
    copyBtn.addEventListener('click', () => {
      textarea.select()
      document.execCommand('copy')
      copyBtn.textContent = '已复制！'
      setTimeout(() => { copyBtn.textContent = '复制到剪贴板' }, 2000)
    })

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '关闭'
    applyButtonStyle(closeBtn)
    closeBtn.addEventListener('click', () => {
      overlay.remove()
    })

    footer.append(copyBtn, closeBtn)
    modal.append(header, textarea, footer)
    overlay.append(modal)
    document.body.append(overlay)

    textarea.focus()
    textarea.select()
  }

  const showImportModal = () => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
    })

    const modal = document.createElement('div')
    Object.assign(modal.style, {
      width: '80%',
      height: '80%',
      background: '#07111f',
      border: '1px solid rgba(238, 245, 238, 0.24)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    })

    const header = document.createElement('div')
    header.textContent = '动作序列导入'
    Object.assign(header.style, {
      fontSize: '16px',
      fontWeight: '600',
      color: '#eef5ee',
    })

    const textarea = document.createElement('textarea')
    textarea.placeholder = '请在此粘贴导出的动作序列 JSON 数据...'
    Object.assign(textarea.style, {
      flex: '1',
      background: 'rgba(7, 17, 31, 0.88)',
      color: '#eef5ee',
      border: '1px solid rgba(238, 245, 238, 0.24)',
      borderRadius: '4px',
      padding: '12px',
      fontFamily: 'monospace',
      fontSize: '13px',
      resize: 'none',
    })

    const footer = document.createElement('div')
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
    })

    const importBtn = document.createElement('button')
    importBtn.textContent = '导入'
    applyButtonStyle(importBtn)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '取消'
    applyButtonStyle(closeBtn)
    closeBtn.addEventListener('click', () => {
      overlay.remove()
    })

    importBtn.addEventListener('click', () => {
      try {
        const data = JSON.parse(textarea.value)
        if (data.type !== 'qixing-town:action-sequence-export') {
          throw new Error('无效的导入数据格式')
        }

        const idMap = new Map()
        const generateNewId = (oldId) => {
          if (!oldId) return ''
          if (idMap.has(oldId)) return idMap.get(oldId)
          const newId = (oldId.startsWith('action-sequence-') ? 'action-sequence-' : 'action-') + 
                        Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
          idMap.set(oldId, newId)
          return newId
        }

        // 1. 处理动作
        const currentActions = readUserActions()
        const importedActions = (data.actions || []).map(action => ({
          ...action,
          id: generateNewId(action.id),
          sourceId: action.sourceId ? generateNewId(action.sourceId) : null,
          controls: (action.controls || []).map(c => ({ ...c, id: `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }))
        }))

        // 2. 处理序列
        const remapStep = (step) => ({
            ...step,
            id: `action-sequence-step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            targetId: step.type === 'delay'
              ? ''
              : step.type === 'position'
                ? step.targetId
                : generateNewId(step.targetId)
        })
        const importedSequences = (data.sequences || []).map(seq => {
          const tracks = Array.isArray(seq.tracks) && seq.tracks.length > 0
            ? seq.tracks.map((track, index) => ({
              ...track,
              id: generateNewId(track.id),
              label: track.label || `轨道 ${index + 1}`,
              loop: track.loop === true,
              steps: (track.steps || []).map(remapStep),
            }))
            : [{
              id: generateNewId(`${seq.id}-track-main`),
              label: '主轨道',
              loop: seq.loop === true,
              steps: (seq.steps || []).map(remapStep),
            }]

          return {
            ...seq,
            id: generateNewId(seq.id),
            steps: tracks[0]?.steps ?? [],
            tracks,
          }
        })

        // 保存动作
        window.localStorage.setItem('qixing-town:user-actions', JSON.stringify(serializeActions([...currentActions, ...importedActions])))
        app.dispatchEvent(new CustomEvent('qixing-town:user-actions-changed'))

        // 保存序列
        sequences = [...sequences, ...importedSequences]
        writeSequences(sequences)
        app.dispatchEvent(new CustomEvent('qixing-town:action-sequences-changed'))

        // 如果有根节点，默认选中
        if (data.rootSequenceId && idMap.has(data.rootSequenceId)) {
          selectedId = idMap.get(data.rootSequenceId)
        }

        persistAndRender()
        overlay.remove()
        alert('导入成功！')
      } catch (err) {
        alert('导入失败：' + err.message)
      }
    })

    footer.append(importBtn, closeBtn)
    modal.append(header, textarea, footer)
    overlay.append(modal)
    document.body.append(overlay)
    textarea.focus()
  }

  const handleExport = () => {
    const sequence = createDraftSequence()
    if (!sequence) return
    const { sequences: exportSequences, actions } = collectExportSequences(sequence)
    const json = JSON.stringify({
      type: 'qixing-town:action-sequence-export',
      version: 1,
      rootSequenceId: sequence.id,
      sequences: exportSequences,
      actions: serializeActions(actions),
    }, null, 2)

    showJsonModal('动作序列导出 JSON', json)
  }

  const handleDelete = () => {
    if (!selectedId) return

    sequences = sequences.filter((sequence) => sequence.id !== selectedId)
    persistAndRender()
  }

  const handleUserActionsChanged = () => {
    if (visible && getSelectedSequence()) renderStepList()
  }

  const handleTrackNameInput = () => {
    updateSelectedTrack({ label: trackNameInput.value })
    renderTrackList()
  }

  const handleTrackLoopChange = () => {
    updateSelectedTrack({ loop: trackLoopInput.checked })
  }

  trackNameInput.addEventListener('input', handleTrackNameInput)
  trackLoopInput.addEventListener('change', handleTrackLoopChange)
  button.addEventListener('click', handleToggle)
  addButton.addEventListener('click', handleAdd)
  importButton.addEventListener('click', showImportModal)
  addTrackButton.addEventListener('click', handleAddTrack)
  deleteTrackButton.addEventListener('click', handleDeleteTrack)
  addStepButton.addEventListener('click', handleAddStep)
  exportButton.addEventListener('click', handleExport)
  saveButton.addEventListener('click', handleSave)
  deleteButton.addEventListener('click', handleDelete)
  app.addEventListener('qixing-town:user-actions-changed', handleUserActionsChanged)
  ;[button, panel, detailPanel].forEach((element) => {
    element.addEventListener('pointerdown', stopPointerLock)
  })

  renderList()
  panel.style.display = visible ? 'block' : 'none'
  syncForm()

  return {
    syncCursorVisible: (cursorVisible) => {
      if (lastCursorVisible === cursorVisible) return

      lastCursorVisible = cursorVisible
      button.style.display = cursorVisible ? 'inline-flex' : 'none'
      if (!cursorVisible) {
        panel.style.display = 'none'
        detailPanel.style.display = 'none'
      } else {
        panel.style.display = visible && !getSelectedSequence() ? 'block' : 'none'
        detailPanel.style.display = visible && getSelectedSequence() ? 'block' : 'none'
      }
    },
    dispose: () => {
      button.removeEventListener('click', handleToggle)
      addButton.removeEventListener('click', handleAdd)
      importButton.removeEventListener('click', showImportModal)
      addTrackButton.removeEventListener('click', handleAddTrack)
      deleteTrackButton.removeEventListener('click', handleDeleteTrack)
      addStepButton.removeEventListener('click', handleAddStep)
      exportButton.removeEventListener('click', handleExport)
      saveButton.removeEventListener('click', handleSave)
      deleteButton.removeEventListener('click', handleDelete)
      trackNameInput.removeEventListener('input', handleTrackNameInput)
      trackLoopInput.removeEventListener('change', handleTrackLoopChange)
      app.removeEventListener('qixing-town:user-actions-changed', handleUserActionsChanged)
      ;[button, panel, detailPanel].forEach((element) => {
        element.removeEventListener('pointerdown', stopPointerLock)
      })
      button.remove()
      panel.remove()
      detailPanel.remove()
    },
  }
}

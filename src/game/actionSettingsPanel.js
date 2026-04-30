import {
  PLAYER_ACTION_BONE_OPTIONS,
  PLAYER_ACTION_IK_CHAIN_OPTIONS,
  PLAYER_ACTION_IK_DEFAULT_TARGETS,
} from './createPlayer.js'

const ACTIONS_STORAGE_KEY = 'qixing-town:user-actions'
const PANEL_STATE_STORAGE_KEY = 'qixing-town:action-settings-panel'
const IK_KEYBOARD_STEP = 0.03

const JOINT_DIRECTIONS = [
  { value: 'forward', label: '向前' },
  { value: 'backward', label: '向后' },
  { value: 'up', label: '向上' },
  { value: 'down', label: '向下' },
]

const createId = () => `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const readUserActions = () => {
  try {
    const actions = JSON.parse(window.localStorage.getItem(ACTIONS_STORAGE_KEY))

    if (!Array.isArray(actions)) return []

    return actions.filter((action) => (
      typeof action?.id === 'string'
      && typeof action?.label === 'string'
    ))
  } catch {
    return []
  }
}

const writeActions = (actions) => {
  try {
    window.localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions))
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

export const createActionSettingsPanel = ({ app, controlsContainer = app, getIkTargetPosition }) => {
  let actions = readUserActions()
  const initialPanelState = readPanelState()
  let selectedId = actions.some((action) => action.id === initialPanelState.selectedId)
    ? initialPanelState.selectedId
    : null
  let visible = initialPanelState.visible
  let lastCursorVisible = null
  let draftActionType = 'fk'
  let draftControls = []
  let draftIkTargets = []
  let activeIkTargetId = null
  let ikKeyboardIntervalId = 0
  const activeIkKeyCodes = new Set()

  const createIkTargetPosition = (chain) => (
    getIkTargetPosition?.(chain)
    ?? { ...PLAYER_ACTION_IK_DEFAULT_TARGETS[chain] }
  )

  const button = document.createElement('button')
  const panel = document.createElement('section')
  const detailPanel = document.createElement('section')
  const list = document.createElement('div')
  const emptyText = document.createElement('div')
  const nameInput = createTextInput()
  const typeSelect = createSelectInput([
    { value: 'fk', label: 'FK' },
    { value: 'ik', label: 'IK' },
  ])
  const controlList = document.createElement('div')
  const emptyControlText = document.createElement('div')
  const addButton = document.createElement('button')
  const addControlButton = document.createElement('button')
  const saveButton = document.createElement('button')
  const deleteButton = document.createElement('button')
  const saveStatusText = document.createElement('span')

  const handleToggle = () => {
    visible = !visible
    panel.style.display = visible ? 'block' : 'none'
    persistPanelState()
    syncForm()
  }

  const handleDetailClose = () => {
    const action = getSelectedAction()

    // 关闭未配置任何运动的动作时直接清理，避免连续新建产生空数据。
    if (action && draftControls.length === 0 && draftIkTargets.length === 0) {
      actions = actions.filter((item) => item.id !== action.id)
      selectedId = null
      persistAndRender()
      return
    }

    selectedId = null
    persistPanelState()
    renderList()
    syncForm()
  }

  button.textContent = '动作设置'
  applyButtonStyle(button)
  Object.assign(button.style, {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    padding: '0px 12px',
  })

  Object.assign(panel.style, {
    position: 'absolute',
    right: '14px',
    top: '16px',
    zIndex: '11',
    display: 'none',
    width: '360px',
    maxWidth: 'calc(100vw - 28px)',
    padding: '12px',
    border: '1px solid rgba(238, 245, 238, 0.18)',
    borderRadius: '8px',
    background: '#07111f',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })

  Object.assign(detailPanel.style, {
    position: 'absolute',
    right: '14px',
    top: '16px',
    zIndex: '12',
    display: 'none',
    width: '430px',
    maxWidth: 'calc(100vw - 28px)',
    padding: '12px',
    border: '1px solid rgba(238, 245, 238, 0.18)',
    borderRadius: '8px',
    background: '#07111f',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })

  const title = document.createElement('div')
  title.textContent = '动作列表'
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

  emptyText.textContent = '暂无动作'
  Object.assign(emptyText.style, {
    display: 'none',
    padding: '12px',
    border: '1px dashed rgba(238, 245, 238, 0.2)',
    borderRadius: '6px',
    color: 'rgba(238, 245, 238, 0.62)',
    textAlign: 'center',
  })

  const form = document.createElement('div')
  Object.assign(form.style, {
    display: 'grid',
    gap: '10px',
  })
  form.append(
    createField({ label: '动作名称', input: nameInput }),
    createField({ label: '控制类型', input: typeSelect }),
  )

  const controlTitle = document.createElement('div')
  const controlHeader = document.createElement('div')
  controlTitle.textContent = '关节运动'
  Object.assign(controlTitle.style, {
    marginTop: '12px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
  })

  Object.assign(controlList.style, {
    display: 'grid',
    gap: '8px',
    maxHeight: '220px',
    overflowY: 'auto',
  })

  controlHeader.replaceChildren(...['关节', '方向', '角度', ''].map((label) => {
    const item = document.createElement('span')
    item.textContent = label
    Object.assign(item.style, {
      color: 'rgba(238, 245, 238, 0.62)',
      fontSize: '12px',
    })
    return item
  }))
  Object.assign(controlHeader.style, {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 80px 52px',
    gap: '8px',
    marginBottom: '6px',
  })

  emptyControlText.textContent = '暂无关节运动'
  Object.assign(emptyControlText.style, {
    display: 'none',
    padding: '10px',
    border: '1px dashed rgba(238, 245, 238, 0.2)',
    borderRadius: '6px',
    color: 'rgba(238, 245, 238, 0.62)',
    textAlign: 'center',
  })

  const detailTitle = document.createElement('div')
  detailTitle.textContent = '动作详情'
  Object.assign(detailTitle.style, {
    marginBottom: '10px',
    fontSize: '15px',
    fontWeight: '600',
  })

  addButton.type = 'button'
  addControlButton.type = 'button'
  saveButton.type = 'button'
  deleteButton.type = 'button'
  addButton.textContent = '新增'
  addControlButton.textContent = '新增关节'
  saveButton.textContent = '保存'
  deleteButton.textContent = '删除'
  applyButtonStyle(addButton)
  applyButtonStyle(addControlButton)
  applyButtonStyle(saveButton)
  applyButtonStyle(deleteButton, 'danger')
  Object.assign(addButton.style, {
    width: '100%',
    borderStyle: 'dashed',
  })
  Object.assign(addControlButton.style, {
    width: '100%',
    borderStyle: 'dashed',
  })
  saveStatusText.textContent = ''
  Object.assign(saveStatusText.style, {
    color: 'rgba(238, 245, 238, 0.62)',
    fontSize: '12px',
    lineHeight: '30px',
    whiteSpace: 'nowrap',
  })

  const controlBar = document.createElement('div')
  Object.assign(controlBar.style, {
    display: 'flex',
    width: '100%',
    marginTop: '8px',
  })
  controlBar.append(addControlButton)

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
    alignItems: 'center',
  })
  saveGroup.append(saveStatusText, saveButton)
  actionsBar.append(deleteButton, saveGroup)

  const addBar = document.createElement('div')
  Object.assign(addBar.style, {
    display: 'flex',
    width: '100%',
    marginTop: '12px',
  })
  addBar.append(addButton)

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

  const panelCloseButton = createCloseButton(handleToggle)
  const detailCloseButton = createCloseButton(handleDetailClose)

  panel.append(panelCloseButton, title, list, emptyText, addBar)
  detailPanel.append(detailCloseButton, detailTitle, form, controlTitle, controlHeader, controlList, emptyControlText, controlBar, actionsBar)
  controlsContainer.append(button)
  app.append(panel, detailPanel)

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }

  const getSelectedAction = () => actions.find((action) => action.id === selectedId) ?? null

  const persistPanelState = () => {
    writePanelState({ visible, selectedId })
  }

  const areControlsEqual = (left, right) => (
    left.length === right.length
    && left.every((control, index) => {
      const target = right[index]
      return target
        && control.bone === target.bone
        && control.direction === target.direction
        && control.angle === target.angle
    })
  )

  const areIkTargetsEqual = (left, right) => (
    left.length === right.length
    && left.every((target, index) => {
      const savedTarget = right[index]
      return savedTarget
        && target.chain === savedTarget.chain
        && target.position?.x === savedTarget.position?.x
        && target.position?.y === savedTarget.position?.y
        && target.position?.z === savedTarget.position?.z
    })
  )

  const isDraftDirty = () => {
    const action = getSelectedAction()
    if (!action) return false

    const savedType = action.type === 'ik' ? 'ik' : 'fk'
    const savedControls = Array.isArray(action.controls) ? action.controls : []
    const savedIkTargets = Array.isArray(action.ikTargets) ? action.ikTargets : []

    return nameInput.value.trim() !== action.label
      || draftActionType !== savedType
      || !areControlsEqual(draftControls, savedControls)
      || !areIkTargetsEqual(draftIkTargets, savedIkTargets)
  }

  const updateSaveStatus = () => {
    saveStatusText.textContent = isDraftDirty() ? '有修改尚未保存' : ''
  }

  const syncDetailPanelPosition = () => {
    detailPanel.style.right = '14px'
    detailPanel.style.top = '16px'
  }

  const syncForm = () => {
    const action = getSelectedAction()
    const disabled = !action

    panel.style.display = visible && !action ? 'block' : 'none'
    detailPanel.style.display = visible && action ? 'block' : 'none'
    addBar.style.display = 'flex'
    nameInput.disabled = disabled
    typeSelect.disabled = disabled
    saveButton.disabled = disabled
    deleteButton.disabled = disabled
    addControlButton.disabled = disabled
    nameInput.value = action?.label ?? ''
    draftActionType = action?.type === 'ik' ? 'ik' : 'fk'
    typeSelect.value = draftActionType
    draftControls = Array.isArray(action?.controls) ? action.controls.map((control) => ({ ...control })) : []
    draftIkTargets = Array.isArray(action?.ikTargets)
      ? action.ikTargets.map((target) => ({
        ...target,
        position: { ...target.position },
      }))
      : []
    activeIkTargetId = draftIkTargets.some((target) => target.id === activeIkTargetId)
      ? activeIkTargetId
      : null
    renderControlList()
    dispatchDraftPreview()
  }

  const updateDraftControl = ({ id, key, value }) => {
    draftControls = draftControls.map((control) => (
      control.id === id ? { ...control, [key]: value } : control
    ))
    dispatchDraftPreview()
  }

  const updateDraftIkTarget = ({ id, key, value }) => {
    draftIkTargets = draftIkTargets.map((target) => {
      if (target.id !== id) return target

      if (key === 'chain') {
        return {
          ...target,
          chain: value,
          position: createIkTargetPosition(value),
        }
      }

      return {
        ...target,
        position: {
          ...target.position,
          [key]: value,
        },
      }
    })
    dispatchDraftPreview()
  }

  const setActiveIkTarget = (id) => {
    activeIkTargetId = id
  }

  const renderControlList = () => {
    controlList.replaceChildren()
    const isIk = draftActionType === 'ik'
    const rows = isIk ? draftIkTargets : draftControls

    controlTitle.textContent = isIk ? 'IK端点' : '关节运动'
    addControlButton.textContent = isIk ? '新增IK' : '新增关节'
    emptyControlText.textContent = isIk ? '暂无IK端点' : '暂无关节运动'
    controlHeader.replaceChildren(...(isIk ? ['', 'IK链', 'X', 'Y', 'Z', ''] : ['关节', '方向', '角度', '']).map((label) => {
      const item = document.createElement('span')
      item.textContent = label
      Object.assign(item.style, {
        color: 'rgba(238, 245, 238, 0.62)',
        fontSize: '12px',
      })
      return item
    }))
    controlHeader.style.gridTemplateColumns = isIk ? '24px 1fr 64px 64px 64px 52px' : '1fr 1fr 80px 52px'
    emptyControlText.style.display = rows.length === 0 ? 'block' : 'none'

    if (isIk) {
      draftIkTargets.forEach((target) => {
        const row = document.createElement('div')
        const activeRadio = document.createElement('input')
        const chainSelect = createSelectInput(PLAYER_ACTION_IK_CHAIN_OPTIONS)
        const xInput = createTextInput()
        const yInput = createTextInput()
        const zInput = createTextInput()
        const removeButton = document.createElement('button')

        activeRadio.type = 'radio'
        activeRadio.name = 'active-ik-target'
        activeRadio.checked = target.id === activeIkTargetId
        activeRadio.title = '选中后可用 WASD / Space / Shift 调整'
        activeRadio.style.margin = '0'
        chainSelect.value = target.chain
        ;[
          [xInput, 'x'],
          [yInput, 'y'],
          [zInput, 'z'],
        ].forEach(([input, key]) => {
          input.type = 'number'
          input.step = '0.01'
          input.value = String(target.position?.[key] ?? 0)
        })
        removeButton.type = 'button'
        removeButton.textContent = '删除'
        applyButtonStyle(removeButton, 'danger')
        Object.assign(row.style, {
          display: 'grid',
          gridTemplateColumns: '24px 1fr 64px 64px 64px 52px',
          gap: '8px',
          alignItems: 'center',
          padding: '4px',
          border: '1px solid',
          borderColor: target.id === activeIkTargetId ? 'rgba(83, 127, 214, 0.72)' : 'transparent',
          borderRadius: '6px',
        })

        row.addEventListener('pointerdown', () => {
          activeIkTargetId = target.id
          dispatchDraftPreview()
        })
        activeRadio.addEventListener('change', () => {
          activeIkTargetId = target.id
          renderControlList()
          dispatchDraftPreview()
        })
        chainSelect.addEventListener('change', () => {
          activeIkTargetId = target.id
          updateDraftIkTarget({ id: target.id, key: 'chain', value: chainSelect.value })
          renderControlList()
        })
        ;[
          [xInput, 'x'],
          [yInput, 'y'],
          [zInput, 'z'],
        ].forEach(([input, key]) => {
          input.addEventListener('focus', () => {
            setActiveIkTarget(target.id)
          })
          input.addEventListener('input', () => {
            activeIkTargetId = target.id
            updateDraftIkTarget({ id: target.id, key, value: Number(input.value) })
          })
        })
        removeButton.addEventListener('click', () => {
          draftIkTargets = draftIkTargets.filter((item) => item.id !== target.id)
          activeIkTargetId = draftIkTargets.some((item) => item.id === activeIkTargetId)
            ? activeIkTargetId
            : null
          renderControlList()
          dispatchDraftPreview()
        })

        row.append(activeRadio, chainSelect, xInput, yInput, zInput, removeButton)
        controlList.append(row)
      })
      return
    }

    draftControls.forEach((control) => {
      const row = document.createElement('div')
      const boneSelect = createSelectInput(PLAYER_ACTION_BONE_OPTIONS)
      const directionSelect = createSelectInput(JOINT_DIRECTIONS)
      const angleInput = createTextInput()
      const removeButton = document.createElement('button')

      boneSelect.value = control.bone
      directionSelect.value = control.direction
      angleInput.type = 'number'
      angleInput.step = '1'
      angleInput.value = String(control.angle)
      removeButton.type = 'button'
      removeButton.textContent = '删除'
      applyButtonStyle(removeButton, 'danger')
      Object.assign(row.style, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 80px 52px',
        gap: '8px',
        alignItems: 'center',
      })

      boneSelect.addEventListener('change', () => {
        updateDraftControl({ id: control.id, key: 'bone', value: boneSelect.value })
      })
      directionSelect.addEventListener('change', () => {
        updateDraftControl({ id: control.id, key: 'direction', value: directionSelect.value })
      })
      angleInput.addEventListener('input', () => {
        updateDraftControl({ id: control.id, key: 'angle', value: Number(angleInput.value) })
      })
      removeButton.addEventListener('click', () => {
        draftControls = draftControls.filter((item) => item.id !== control.id)
        renderControlList()
        dispatchDraftPreview()
      })

      row.append(boneSelect, directionSelect, angleInput, removeButton)
      controlList.append(row)
    })
  }

  const renderList = () => {
    list.replaceChildren()
    emptyText.style.display = actions.length === 0 ? 'block' : 'none'

    actions.forEach((action) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.textContent = action.label
      applyButtonStyle(item)
      Object.assign(item.style, {
        width: '100%',
        textAlign: 'left',
        background: action.id === selectedId ? 'rgba(83, 127, 214, 0.42)' : 'rgba(238, 245, 238, 0.08)',
      })
      item.addEventListener('click', () => {
        selectedId = action.id
        persistPanelState()
        renderList()
        syncForm()
      })
      list.append(item)
    })
  }

  const persistAndRender = () => {
    writeActions(actions)
    app.dispatchEvent(new CustomEvent('qixing-town:user-actions-changed'))
    if (!actions.some((action) => action.id === selectedId)) {
      selectedId = null
    }
    persistPanelState()
    renderList()
    syncForm()
  }

  const handleAdd = () => {
    const nextAction = {
      id: createId(),
      label: `新动作 ${actions.length + 1}`,
      controls: [],
    }

    actions = [...actions, nextAction]
    selectedId = nextAction.id
    persistAndRender()
  }

  const handleSave = () => {
    const action = getSelectedAction()
    if (!action) return

    const label = nameInput.value.trim()
    if (!label) return
    const controls = draftControls.filter((control) => (
      PLAYER_ACTION_BONE_OPTIONS.some((bone) => bone.value === control.bone)
      && JOINT_DIRECTIONS.some((direction) => direction.value === control.direction)
      && Number.isFinite(control.angle)
    ))
    const ikTargets = draftIkTargets.filter((target) => (
      PLAYER_ACTION_IK_CHAIN_OPTIONS.some((chain) => chain.value === target.chain)
      && Number.isFinite(target.position?.x)
      && Number.isFinite(target.position?.y)
      && Number.isFinite(target.position?.z)
    ))

    actions = actions.map((item) => (
      item.id === action.id
        ? { ...item, label, type: draftActionType, controls, ikTargets }
        : item
    ))
    persistAndRender()
  }

  const handleAddControl = () => {
    if (!getSelectedAction()) return

    if (draftActionType === 'ik') {
      const chain = PLAYER_ACTION_IK_CHAIN_OPTIONS[0]?.value
      if (!chain) return
      const id = createId()

      draftIkTargets = [
        ...draftIkTargets,
        {
          id,
          chain,
          position: createIkTargetPosition(chain),
        },
      ]
      activeIkTargetId = id
      renderControlList()
      dispatchDraftPreview()
      return
    }

    draftControls = [
      ...draftControls,
      {
        id: createId(),
        bone: PLAYER_ACTION_BONE_OPTIONS[0].value,
        direction: JOINT_DIRECTIONS[0].value,
        angle: 0,
      },
    ]
    renderControlList()
    dispatchDraftPreview()
  }

  const createDraftAction = (action) => {
    const label = nameInput.value.trim()

    return {
      ...action,
      label: label || action.label,
      type: draftActionType,
      activeIkTargetId: draftActionType === 'ik' ? activeIkTargetId : null,
      controls: draftControls.map((control) => ({ ...control })),
      ikTargets: draftIkTargets.map((target) => ({
        ...target,
        position: { ...target.position },
      })),
    }
  }

  const clearIkTargetMarkers = () => {
    app.dispatchEvent(new CustomEvent('qixing-town:clear-ik-target-markers'))
  }

  const dispatchDraftPreview = () => {
    updateSaveStatus()
    const action = getSelectedAction()
    if (!visible || detailPanel.style.display !== 'block' || !action) {
      clearIkTargetMarkers()
      return
    }

    app.dispatchEvent(new CustomEvent('qixing-town:play-action', {
      detail: {
        action: createDraftAction(action),
        preview: true,
      },
    }))
  }

  const handleDelete = () => {
    if (!selectedId) return

    actions = actions.filter((action) => action.id !== selectedId)
    persistAndRender()
  }

  const handleCancel = () => {
    selectedId = null
    persistPanelState()
    renderList()
    syncForm()
  }

  const handleTypeChange = () => {
    draftActionType = typeSelect.value === 'ik' ? 'ik' : 'fk'
    activeIkTargetId = null
    renderControlList()
    dispatchDraftPreview()
  }

  const isIkKeyboardActive = () => (
    visible
    && draftActionType === 'ik'
    && getSelectedAction()
    && detailPanel.style.display === 'block'
  )

  const getIkKeyOffset = (code) => {
    if (code === 'KeyW') return { z: -IK_KEYBOARD_STEP }
    if (code === 'KeyS') return { z: IK_KEYBOARD_STEP }
    if (code === 'KeyA') return { x: -IK_KEYBOARD_STEP }
    if (code === 'KeyD') return { x: IK_KEYBOARD_STEP }
    if (code === 'Space') return { y: IK_KEYBOARD_STEP }
    if (code === 'ShiftLeft' || code === 'ShiftRight') return { y: -IK_KEYBOARD_STEP }

    return null
  }

  const applyIkKeyboardOffset = (offset) => {
    if (!isIkKeyboardActive()) return

    const targetId = draftIkTargets.some((target) => target.id === activeIkTargetId)
      ? activeIkTargetId
      : null
    if (!targetId) return

    activeIkTargetId = targetId
    draftIkTargets = draftIkTargets.map((target) => {
      if (target.id !== targetId) return target

      return {
        ...target,
        position: {
          x: (target.position?.x ?? 0) + (offset.x ?? 0),
          y: (target.position?.y ?? 0) + (offset.y ?? 0),
          z: (target.position?.z ?? 0) + (offset.z ?? 0),
        },
      }
    })
    renderControlList()
    dispatchDraftPreview()
  }

  const applyActiveIkKeyboardOffsets = () => {
    if (!isIkKeyboardActive()) {
      activeIkKeyCodes.clear()
      window.clearInterval(ikKeyboardIntervalId)
      ikKeyboardIntervalId = 0
      return
    }

    activeIkKeyCodes.forEach((code) => {
      applyIkKeyboardOffset(getIkKeyOffset(code))
    })
  }

  const handleIkKeyDown = (event) => {
    if (!visible || draftActionType !== 'ik' || !getSelectedAction()) return
    if (detailPanel.style.display !== 'block') return
    if (event.target === nameInput || event.target === typeSelect) return

    const offset = getIkKeyOffset(event.code)
    if (!offset) return

    event.preventDefault()
    activeIkKeyCodes.add(event.code)
    if (!event.repeat) applyIkKeyboardOffset(offset)
    if (!ikKeyboardIntervalId) {
      ikKeyboardIntervalId = window.setInterval(applyActiveIkKeyboardOffsets, 48)
    }
  }

  const handleIkKeyUp = (event) => {
    activeIkKeyCodes.delete(event.code)
    if (activeIkKeyCodes.size > 0) return

    window.clearInterval(ikKeyboardIntervalId)
    ikKeyboardIntervalId = 0
  }

  button.addEventListener('click', handleToggle)
  nameInput.addEventListener('input', dispatchDraftPreview)
  typeSelect.addEventListener('change', handleTypeChange)
  addButton.addEventListener('click', handleAdd)
  addControlButton.addEventListener('click', handleAddControl)
  saveButton.addEventListener('click', handleSave)
  deleteButton.addEventListener('click', handleDelete)
  window.addEventListener('keydown', handleIkKeyDown)
  window.addEventListener('keyup', handleIkKeyUp)
  window.addEventListener('resize', syncDetailPanelPosition)
    ;[button, panel, detailPanel].forEach((element) => {
      element.addEventListener('pointerdown', stopPointerLock)
    })

  renderList()
  syncDetailPanelPosition()
  panel.style.display = visible ? 'block' : 'none'
  syncForm()
  queueMicrotask(() => {
    if (visible && getSelectedAction()) dispatchDraftPreview()
  })

  return {
    syncCursorVisible: (cursorVisible) => {
      if (lastCursorVisible === cursorVisible) return

      lastCursorVisible = cursorVisible
      button.style.display = cursorVisible ? 'inline-flex' : 'none'
      if (!cursorVisible) {
        panel.style.display = 'none'
        detailPanel.style.display = 'none'
        clearIkTargetMarkers()
      } else {
        panel.style.display = visible && !getSelectedAction() ? 'block' : 'none'
        detailPanel.style.display = visible && getSelectedAction() ? 'block' : 'none'
        dispatchDraftPreview()
      }
    },
    dispose: () => {
      clearIkTargetMarkers()
      button.removeEventListener('click', handleToggle)
      nameInput.removeEventListener('input', dispatchDraftPreview)
      typeSelect.removeEventListener('change', handleTypeChange)
      addButton.removeEventListener('click', handleAdd)
      addControlButton.removeEventListener('click', handleAddControl)
      saveButton.removeEventListener('click', handleSave)
      deleteButton.removeEventListener('click', handleDelete)
      window.removeEventListener('keydown', handleIkKeyDown)
      window.removeEventListener('keyup', handleIkKeyUp)
      window.clearInterval(ikKeyboardIntervalId)
      window.removeEventListener('resize', syncDetailPanelPosition)
        ;[button, panel, detailPanel].forEach((element) => {
          element.removeEventListener('pointerdown', stopPointerLock)
        })
      button.remove()
      panel.remove()
      detailPanel.remove()
    },
  }
}

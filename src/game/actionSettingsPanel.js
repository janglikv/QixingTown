const ACTIONS_STORAGE_KEY = 'qixing-town:user-actions'
const PANEL_STATE_STORAGE_KEY = 'qixing-town:action-settings-panel'

const JOINT_OPTIONS = [
  { value: 'hip', label: '身体' },
  { value: 'neck', label: '头部' },
  { value: 'bothArms', label: '双臂' },
  { value: 'shoulderLeft', label: '左臂' },
  { value: 'shoulderRight', label: '右臂' },
  { value: 'bothHands', label: '双手' },
  { value: 'elbowLeft', label: '左手' },
  { value: 'elbowRight', label: '右手' },
  { value: 'bothLegs', label: '双腿' },
  { value: 'hipLeft', label: '左腿' },
  { value: 'hipRight', label: '右腿' },
  { value: 'bothFeet', label: '双脚' },
  { value: 'kneeLeft', label: '左脚' },
  { value: 'kneeRight', label: '右脚' },
]

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

export const createActionSettingsPanel = ({ app }) => {
  let actions = readUserActions()
  const initialPanelState = readPanelState()
  let selectedId = actions.some((action) => action.id === initialPanelState.selectedId)
    ? initialPanelState.selectedId
    : null
  let visible = initialPanelState.visible
  let lastCursorVisible = null
  let draftControls = []

  const button = document.createElement('button')
  const panel = document.createElement('section')
  const detailPanel = document.createElement('section')
  const list = document.createElement('div')
  const emptyText = document.createElement('div')
  const nameInput = createTextInput()
  const controlList = document.createElement('div')
  const emptyControlText = document.createElement('div')
  const addButton = document.createElement('button')
  const addControlButton = document.createElement('button')
  const saveButton = document.createElement('button')
  const deleteButton = document.createElement('button')
  const cancelButton = document.createElement('button')

  button.type = 'button'
  button.textContent = '动作设置'
  applyButtonStyle(button)
  Object.assign(button.style, {
    position: 'absolute',
    right: '14px',
    top: '56px',
    zIndex: '10',
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
    top: '98px',
    zIndex: '11',
    display: 'none',
    width: '360px',
    maxWidth: 'calc(100vw - 28px)',
    padding: '12px',
    border: '1px solid rgba(238, 245, 238, 0.18)',
    borderRadius: '8px',
    background: 'rgba(7, 17, 31, 0.9)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })

  Object.assign(detailPanel.style, {
    position: 'absolute',
    right: '388px',
    top: '98px',
    zIndex: '11',
    display: 'none',
    width: '430px',
    maxWidth: 'calc(100vw - 28px)',
    padding: '12px',
    border: '1px solid rgba(238, 245, 238, 0.18)',
    borderRadius: '8px',
    background: 'rgba(7, 17, 31, 0.9)',
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
    maxHeight: '180px',
    overflowY: 'auto',
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
  cancelButton.type = 'button'
  addButton.textContent = '新增'
  addControlButton.textContent = '新增关节'
  saveButton.textContent = '保存'
  deleteButton.textContent = '删除'
  cancelButton.textContent = '取消'
  applyButtonStyle(addButton)
  applyButtonStyle(addControlButton)
  applyButtonStyle(saveButton)
  applyButtonStyle(deleteButton, 'danger')
  applyButtonStyle(cancelButton)

  const controlBar = document.createElement('div')
  Object.assign(controlBar.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  })
  controlBar.append(addControlButton)

  const actionsBar = document.createElement('div')
  Object.assign(actionsBar.style, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '12px',
  })
  actionsBar.append(cancelButton, saveButton, deleteButton)

  const addBar = document.createElement('div')
  Object.assign(addBar.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '12px',
  })
  addBar.append(addButton)
  panel.append(title, list, emptyText, addBar)
  detailPanel.append(detailTitle, form, controlTitle, controlHeader, controlList, emptyControlText, controlBar, actionsBar)
  app.append(button, panel, detailPanel)

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }

  const getSelectedAction = () => actions.find((action) => action.id === selectedId) ?? null

  const persistPanelState = () => {
    writePanelState({ visible, selectedId })
  }

  const syncDetailPanelPosition = () => {
    const wideLayout = window.innerWidth >= 740

    detailPanel.style.right = wideLayout ? '388px' : '14px'
    detailPanel.style.top = wideLayout ? '98px' : '420px'
  }

  const syncForm = () => {
    const action = getSelectedAction()
    const disabled = !action

    detailPanel.style.display = visible && action ? 'block' : 'none'
    addBar.style.display = 'flex'
    nameInput.disabled = disabled
    saveButton.disabled = disabled
    deleteButton.disabled = disabled
    cancelButton.disabled = disabled
    addControlButton.disabled = disabled
    nameInput.value = action?.label ?? ''
    draftControls = Array.isArray(action?.controls) ? action.controls.map((control) => ({ ...control })) : []
    renderControlList()
    dispatchDraftPreview()
  }

  const updateDraftControl = ({ id, key, value }) => {
    draftControls = draftControls.map((control) => (
      control.id === id ? { ...control, [key]: value } : control
    ))
    dispatchDraftPreview()
  }

  const renderControlList = () => {
    controlList.replaceChildren()
    emptyControlText.style.display = draftControls.length === 0 ? 'block' : 'none'

    draftControls.forEach((control) => {
      const row = document.createElement('div')
      const boneSelect = createSelectInput(JOINT_OPTIONS)
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
    selectedId = null
    persistAndRender()
  }

  const handleSave = () => {
    const action = getSelectedAction()
    if (!action) return

    const label = nameInput.value.trim()
    if (!label) return
    const controls = draftControls.filter((control) => (
      JOINT_OPTIONS.some((bone) => bone.value === control.bone)
      && JOINT_DIRECTIONS.some((direction) => direction.value === control.direction)
      && Number.isFinite(control.angle)
    ))

    actions = actions.map((item) => (
      item.id === action.id
        ? { ...item, label, controls }
        : item
    ))
    persistAndRender()
  }

  const handleAddControl = () => {
    if (!getSelectedAction()) return

    draftControls = [
      ...draftControls,
      {
        id: createId(),
        bone: JOINT_OPTIONS[0].value,
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
      controls: draftControls.map((control) => ({ ...control })),
    }
  }

  const dispatchDraftPreview = () => {
    const action = getSelectedAction()
    if (!action) return

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

  const handleToggle = () => {
    visible = !visible
    panel.style.display = visible ? 'block' : 'none'
    persistPanelState()
    syncForm()
  }

  button.addEventListener('click', handleToggle)
  addButton.addEventListener('click', handleAdd)
  addControlButton.addEventListener('click', handleAddControl)
  saveButton.addEventListener('click', handleSave)
  deleteButton.addEventListener('click', handleDelete)
  cancelButton.addEventListener('click', handleCancel)
  window.addEventListener('resize', syncDetailPanelPosition)
    ;[button, panel, detailPanel].forEach((element) => {
      element.addEventListener('pointerdown', stopPointerLock)
      element.addEventListener('click', stopPointerLock)
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
      } else {
        panel.style.display = visible ? 'block' : 'none'
        detailPanel.style.display = visible && getSelectedAction() ? 'block' : 'none'
      }
    },
    dispose: () => {
      button.removeEventListener('click', handleToggle)
      addButton.removeEventListener('click', handleAdd)
      addControlButton.removeEventListener('click', handleAddControl)
      saveButton.removeEventListener('click', handleSave)
      deleteButton.removeEventListener('click', handleDelete)
      cancelButton.removeEventListener('click', handleCancel)
      window.removeEventListener('resize', syncDetailPanelPosition)
        ;[button, panel, detailPanel].forEach((element) => {
          element.removeEventListener('pointerdown', stopPointerLock)
          element.removeEventListener('click', stopPointerLock)
        })
      button.remove()
      panel.remove()
      detailPanel.remove()
    },
  }
}

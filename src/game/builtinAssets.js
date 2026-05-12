export const BUILTIN_ACTIONS = [
  {
    "id": "action-mp1zw0u0-n6jj4",
    "label": "跑1",
    "controls": [
      {
        "id": "action-mp1zy8vx-gvdr8",
        "bone": "kneeLeft",
        "direction": "forward",
        "angle": -57
      },
      {
        "id": "action-mp200oci-0rn96",
        "bone": "hipLeft",
        "direction": "forward",
        "angle": 60
      },
      {
        "id": "action-mp2019w8-8dhuf",
        "bone": "hipRight",
        "direction": "backward",
        "angle": 20
      },
      {
        "id": "action-mp231qkh-smvb5",
        "bone": "hip",
        "direction": "forward",
        "angle": -26
      },
      {
        "id": "action-mp2cetox-yqbs5",
        "bone": "kneeRight",
        "direction": "backward",
        "angle": 60
      },
      {
        "id": "action-mp2340sm-5rdgk",
        "bone": "shoulderRight",
        "direction": "forward",
        "angle": 80
      },
      {
        "id": "action-mp2352iq-rhqxi",
        "bone": "elbowRight",
        "direction": "forward",
        "angle": 90
      },
      {
        "id": "action-mp2361u0-dzh9a",
        "bone": "shoulderLeft",
        "direction": "backward",
        "angle": 80
      },
      {
        "id": "action-mp2cdcol-saaay",
        "bone": "elbowLeft",
        "direction": "forward",
        "angle": 63
      }
    ],
    "type": "fk",
    "ikTargets": []
  },
  {
    "id": "action-mp2batu1-k2xon",
    "label": "跑1 (镜像)",
    "sourceId": "action-mp1zw0u0-n6jj4",
    "isMirrored": true,
    "type": "fk",
    "controls": [],
    "ikTargets": []
  }
]

export const BUILTIN_SEQUENCES = [
  {
    "id": "action-sequence-mp1zv1sf-6c3eb",
    "label": "奔跑",
    "loop": true,
    "steps": [
      {
        "id": "action-sequence-mp1zv1sf-hmsa4",
        "type": "action",
        "targetId": "action-mp1zw0u0-n6jj4",
        "repeat": 1,
        "duration": 0.3
      },
      {
        "id": "action-sequence-mp2040pg-hntzf",
        "type": "action",
        "targetId": "action-mp2batu1-k2xon",
        "repeat": 1,
        "duration": 0.3
      }
    ]
  }
]

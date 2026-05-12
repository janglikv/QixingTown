export const BUILTIN_ACTIONS = [
  {
    "id": "action-mp1zw0u0-n6jj4",
    "label": "跑1",
    "controls": [
      {
        "id": "action-mp200oci-0rn96",
        "bone": "hipLeft",
        "direction": "forward",
        "angle": 60
      },
      {
        "id": "action-mp1zy8vx-gvdr8",
        "bone": "kneeLeft",
        "direction": "forward",
        "angle": -57
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
        "angle": -24
      },
      {
        "id": "action-mp2340sm-5rdgk",
        "bone": "shoulderRight",
        "direction": "forward",
        "angle": 84
      },
      {
        "id": "action-mp2352iq-rhqxi",
        "bone": "elbowRight",
        "direction": "up",
        "angle": -94
      },
      {
        "id": "action-mp2361u0-dzh9a",
        "bone": "shoulderLeft",
        "direction": "backward",
        "angle": 35
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
    "controls": [
      {
        "id": "action-mp2bqxzp-41oke",
        "bone": "hipRight",
        "direction": "forward",
        "angle": 60
      },
      {
        "id": "action-mp2bqxzp-othqi",
        "bone": "kneeRight",
        "direction": "forward",
        "angle": -57
      },
      {
        "id": "action-mp2bqxzp-mdf5b",
        "bone": "hipLeft",
        "direction": "backward",
        "angle": 20
      },
      {
        "id": "action-mp2bqxzp-78lrv",
        "bone": "hip",
        "direction": "forward",
        "angle": -24
      },
      {
        "id": "action-mp2bqxzp-bieje",
        "bone": "shoulderLeft",
        "direction": "forward",
        "angle": 84
      },
      {
        "id": "action-mp2bqxzp-h71tb",
        "bone": "elbowLeft",
        "direction": "up",
        "angle": -94
      },
      {
        "id": "action-mp2bqxzp-3rpwl",
        "bone": "shoulderRight",
        "direction": "backward",
        "angle": 35
      }
    ],
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

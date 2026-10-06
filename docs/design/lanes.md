# Pre-closure code lane and the N15 lane

Rulings (James, 2026-10-07). Each lane has its own gate and its own word.

## Pre-closure code lane (after B8, before N15)

Delete the diag endpoint and its preview beacons (RENA-004, string law
applies); build the signed-in devices UI (device/platform, last seen, current
session marker, sign out this device) on the DeviceSession model (RENA-007
step two). Own gate.

## N15 lane (after the pre-closure code lane, before B9)

The Next 15 and React 19 migration exactly as scoped in B6.9 (see
[B6.md](B6.md)), with its revert branch staged; its own gate; the final
regression (B9) runs on Next 15. Closes RENA-001 step two.

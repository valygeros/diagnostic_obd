/** Simulated vehicles and adapters (CLAUDE.md §11). */

/** Mode 01 PID value: fixed data bytes, or a function of time (seconds since start). */
export type PidValue = readonly number[] | ((t: number) => readonly number[])

export interface SimEcu {
  /** CAN response id ("7E8", "18DAF110") or legacy source address ("10"). */
  id: string
  /** Mode 01 PIDs → data bytes (without the 41 xx prefix). Bitmaps are generated. */
  pids: Record<number, PidValue>
  dtcs?: {
    stored?: string[]
    pending?: string[]
    /** Permanent codes survive a clear (as on real cars, until the fault is gone). */
    permanent?: string[]
  }
  /** Check engine light. Defaults to "on if stored codes". */
  mil?: boolean
  /** Raw readiness bytes B, C, D of PID 01 (B bit 3 = diesel). */
  monitors?: [number, number, number]
  vin?: string
  /** Service 09 PID 0A (ECU name, ≤ 20 chars). */
  ecuName?: string
}

export interface CloneQuirks {
  /** Keeps echoing after ATE0. */
  ignoresEchoOff?: boolean
  /** AT commands answered with "?". */
  refuses?: string[]
  /** Replies in lowercase. */
  lowercase?: boolean
}

export interface Scenario {
  id: string
  /** Short French label for the demo picker. */
  label: string
  description: string
  /** ELM protocol number the car uses ('1'..'9'). */
  protocol: string
  ecus: SimEcu[]
  adapter?: {
    id?: string
    stnId?: string
    voltage?: number
    quirks?: CloneQuirks
  }
  behaviour?: {
    /** Car never answers: UNABLE TO CONNECT after the search. */
    noVehicle?: boolean
    /** Link lost after this many OBD requests. */
    disconnectAfterRequests?: number
    /** Duration of the protocol search, ms. */
    searchDelayMs?: number
  }
}

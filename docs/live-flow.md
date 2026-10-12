# Live flow: state machine + interaksi komponen

Hasil task `2026-10-12-live-heal-nourut-totals-edit` (auto-sembuh, guard `no_urut`, banner totals, edit lokal).

## A. State machine sesi Live

```mermaid
flowchart TD
    subgraph Boot["Boot / Resume"]
        R["resume: baca sesi open terakhir"] --> R1{ada sesi open?}
        R1 -- tidak --> IDLE["[--] idle"]
        R1 -- ya --> RE["restore everBroken=!complete + poll 2dtk"]
        RE --> BUKA
    end
    subgraph Main["Siklus sesi"]
        O["[buka] openSession"] --> H{health ok?}
        H -- ya --> D["drain: loop since/limit=50"]
        H -- tidak --> PUTUS
        D --> D1{fetch ok semua batch?}
        D1 -- ya --> HEAL["heal: everBroken=false + complete=1"]
        D1 -- gagal batch mana pun --> PUTUS
        HEAL --> BUKA["[BUKA·ok]"]
        PUTUS["status PUTUS + complete=0"] --> POLL{{"poll 2dtk / coba lagi"}}
        BUKA --> POLL
        POLL --> D
        POLL --> T["[tutup] closeCurrent"]
        T --> RIW[("riwayat: lengkap / belum lengkap")]
        RIW -- dobel-tap closed --> RE2["reopen: lanjut since=last_seen"]
        RE2 --> D
    end
    subgraph Data["Distribusi data tiap drain ok"]
        D1 -- ok --> UP["upsertTx idempoten: skip edited + no dobel"]
        UP --> G{lompat no_urut per-hari?}
        G -- ya --> HL["sisip baris HILANG merah, status tetap ok"]
        G -- tidak --> TT["renderTotals: tunai/nontunai/semua"]
        HL --> TT
    end
    subgraph Edit["Koreksi lokal"]
        L[dobel-tap baris tx] --> F["form inline T/NT + simpan/batal"]
        F -- simpan valid --> P["patchTx: total+kategori auto + edited=1"]
        P --> TT
        F -- negatif --> F
    end
    style BUKA fill:#0f3d2e,stroke:#3ddc97,color:#fff
    style PUTUS fill:#4a1d1d,stroke:#ff7a7a,color:#fff
    style HEAL fill:#0f3d2e,stroke:#3ddc97,color:#fff
    style HL fill:#4a1d1d,stroke:#ff7a7a,color:#fff
```

## B. Sequence end-to-end

```mermaid
sequenceDiagram
    autonumber
    actor U as User (HP)
    participant L as live.js
    participant N as lan.js
    participant P as CNdesktop (/api/*)
    participant S as store.js (localStorage)
    U->>L: [buka] + isi IP PC
    L->>N: health(base)
    N->>P: GET /api/health
    P-->>N: {ok:true}
    N-->>L: {ok:true}
    L->>S: createSession → last_seen=0
    loop drain since/limit=50 (stop saat batch tak penuh)
        L->>N: fetchTx(since)
        N->>P: GET /api/transactions?since&limit
        P-->>N: rows (id, no_transaksi, no_urut, ...)
        N-->>L: rows ternormalisasi (+no_urut apa adanya)
        L->>S: upsertTx (skip server_id/no_transaksi ganda + edited)
    end
    alt drain tuntas
        L->>S: patchSession complete=1 (heal)
        L->>U: [BUKA·ok] + banner totals
    else fetch gagal di batch mana pun
        L->>S: patchSession complete=0
        L->>U: [PUTUS] (error hanya di label status)
    end
    loop tiap 2 dtk / [coba lagi]
        L->>N: fetchTx(last_seen)
        N->>P: GET /api/transactions
        P-->>N: rows baru
        L->>S: upsertTx + renderList (sisip HILANG bila no_urut lompat)
        L->>U: totals tunai/nontunai/semua (HILANG excluded)
    end
    U->>L: dobel-tap baris tx (sesi open)
    L->>U: form inline T/NT
    U->>L: [simpan] (digit saja, kosong→0, tolak -)
    L->>S: patchTx (total+kategori auto, edited=1)
    L->>U: list + totals ter refresh (drain berikut tak menimpa)
    U->>L: [tutup]
    L->>S: closeSession (lengkap bila tak pernah-putus-tak-sembuh)
```

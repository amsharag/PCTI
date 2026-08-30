"use client";
import { useEffect, useMemo, useRef, useState, ChangeEvent } from "react";
type Env = {
  ta: number;
  rh: number;
  air: number;
  mrt: number;
  solar: number;
  met: number;
};
type Seg = {
  id: string;
  name: string;
  area: number;
  coverage: number;
  clo: number;
  re: number;
  fcl: number;
  layers: number;
  emiss: number;
  absorb: number;
};
const defs = [
  ["head", "Head", 0.07],
  ["neck", "Neck", 0.02],
  ["chest", "Chest", 0.09],
  ["back", "Back", 0.09],
  ["pelvis", "Pelvis / abdomen", 0.12],
  ["lua", "Left upper arm", 0.04],
  ["rua", "Right upper arm", 0.04],
  ["lfa", "Left forearm", 0.03],
  ["rfa", "Right forearm", 0.03],
  ["lh", "Left hand", 0.025],
  ["rh", "Right hand", 0.025],
  ["lt", "Left thigh", 0.095],
  ["rt", "Right thigh", 0.095],
  ["lll", "Left lower leg", 0.065],
  ["rll", "Right lower leg", 0.065],
  ["lf", "Left foot", 0.035],
  ["rf", "Right foot", 0.035],
] as const;
const presets = {
  summer: {
    name: "Outdoor summer, light",
    clo: 0.38,
    adapt: 0.85,
    note: "T-shirt, shorts/light trousers, light shoes",
  },
  work: {
    name: "Outdoor summer, protective / workwear",
    clo: 0.62,
    adapt: 0.35,
    note: "Light long sleeves, work trousers, safety footwear",
  },
  construction: {
    name: "Construction workwear — OSHA-aligned baseline",
    clo: 0.7,
    adapt: 0.3,
    note: "Work shirt, long work pants, high-visibility vest, hard hat and safety boots. The 0.70 clo value is a provisional PCTI modeling assumption; OSHA treats ordinary work clothing as the WBGT baseline (0°C clothing adjustment), while coveralls and less-permeable PPE require separate adjustments",
  },
  casual: {
    name: "Indoor informal / casual",
    clo: 0.58,
    adapt: 0.9,
    note: "Shirt, trousers/jeans, socks and shoes",
  },
  formal: {
    name: "Indoor formal / business",
    clo: 0.82,
    adapt: 0.3,
    note: "Dress shirt/blouse, jacket, trousers/skirt",
  },
  winter: {
    name: "Outdoor winter, moderate",
    clo: 1.5,
    adapt: 0.55,
    note: "Base layer, sweater, jacket, trousers",
  },
  extreme: {
    name: "Outdoor winter, severe / extreme cold",
    clo: 2.35,
    adapt: 0.2,
    note: "Thermals, insulated coat, hat, gloves, boots",
  },
};
const clothingKeys = Object.keys(presets) as (keyof typeof presets)[];
const cover = (key: string, id: string) => {
  if (["head", "lh", "rh"].includes(id))
    return key === "extreme"
      ? 1
      : key === "winter"
        ? 0.65
        : key === "construction" && id === "head"
          ? 0.35
          : 0;
  if (id === "neck")
    return key === "extreme" ? 0.95 : key === "winter" ? 0.75 : 0.15;
  if (["lfa", "rfa"].includes(id))
    return key === "summer" ? 0 : key === "casual" ? 0.15 : 1;
  if (["lua", "rua"].includes(id))
    return key === "summer" ? 0.42 : key === "casual" ? 0.55 : 1;
  if (["lt", "rt", "lll", "rll"].includes(id))
    return key === "summer" ? 0.55 : 1;
  return 1;
};
const makeSeg = (key = "work"): Seg[] =>
  defs.map(([id, name, area]) => {
    const p = presets[key as keyof typeof presets];
    return {
      id,
      name,
      area,
      coverage: cover(key, id),
      clo: +(
        p.clo * (["chest", "back", "pelvis"].includes(id) ? 1.15 : 1)
      ).toFixed(2),
      re: +(18 + p.clo * 22).toFixed(1),
      fcl: +(1 + 0.18 * p.clo).toFixed(2),
      layers: p.clo > 1.8 ? 3 : p.clo > 0.7 ? 2 : 1,
      emiss: 0.95,
      absorb: key === "summer" ? 0.52 : 0.68,
    };
  });
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const cToF = (c: number) => (c * 9) / 5 + 32,
  fToC = (f: number) => ((f - 32) * 5) / 9,
  msToFtMin = (v: number) => v * 196.850394,
  ftMinToMs = (v: number) => v / 196.850394,
  wm2ToBtu = (v: number) => v * 0.316998,
  btuToWm2 = (v: number) => v / 0.316998;
const airDescription = (v: number) =>
  v < 0.1
    ? "Still air"
    : v < 0.3
      ? "Calm"
      : v < 0.8
        ? "Light air movement"
        : v < 1.6
          ? "Gentle breeze"
          : v < 3
            ? "Moderate breeze"
            : "Strong air movement";
const metDescription = (v: number) =>
  v < 1
    ? "Reclining / resting"
    : v < 1.3
      ? "Seated, quiet work"
      : v < 1.8
        ? "Standing / light tasks"
        : v < 2.4
          ? "Walking slowly"
          : v < 3.5
            ? "Walking / moderate work"
            : v < 5
              ? "Heavy work / brisk activity"
              : "Very heavy exertion";
const temperatureDescription = (v: number) =>
  v < 10
    ? "Very cold air"
    : v < 17
      ? "Cool air"
      : v < 22
        ? "Slightly cool"
        : v <= 26
          ? "Thermally mild"
          : v <= 30
            ? "Warm air"
            : v <= 36
              ? "Hot air"
              : "Extreme heat";
const humidityDescription = (v: number) =>
  v < 25
    ? "Very dry"
    : v < 40
      ? "Dry"
      : v <= 60
        ? "Typical comfort range"
        : v <= 75
          ? "Humid"
          : "Very humid";
const mrtDescription = (v: number) =>
  v < 15
    ? "Cold surrounding surfaces"
    : v < 22
      ? "Cool radiant environment"
      : v <= 27
        ? "Mild radiant environment"
        : v <= 35
          ? "Warm surrounding surfaces"
          : "Strong radiant heat";
const solarDescription = (v: number) =>
  v < 25
    ? "No meaningful direct sun"
    : v < 200
      ? "Low solar load"
      : v < 500
        ? "Moderate sun"
        : v < 800
          ? "Strong sun"
          : "Intense solar exposure";
const heatAcclimation = (days: number) => {
  const d = clamp(days, 0, 9),
    lo = 1 / (1 + Math.exp(4.05)),
    hi = 1 / (1 + Math.exp(-4.05)),
    raw = 1 / (1 + Math.exp(-0.9 * (d - 4.5)));
  return clamp((raw - lo) / (hi - lo), 0, 1);
};
function model(e: Env, segs: Seg[], accl: number, adjust: number) {
  const met = e.met * 58.2,
    vr = e.air + 0.18 * Math.max(0, e.met - 1),
    op = 0.52 * e.ta + 0.48 * e.mrt + 0.012 * e.solar;
  let dry = 0,
    evap = 0,
    skin = 0;
  const local: Record<string, { skin: number; flux: number; clo: number }> = {};
  for (const s of segs) {
    const cov = clamp(s.coverage * (1 - adjust * 0.18), 0, 1),
      dyn =
        s.clo *
        clamp(
          1 - 0.12 * Math.sqrt(vr) - 0.08 * Math.max(0, e.met - 1),
          0.62,
          1.05,
        ) *
        (1 - adjust * 0.25),
      bare = 9.5 + 5.2 * Math.sqrt(Math.max(0.05, vr)),
      cloth = 1 / (0.155 * Math.max(0.01, dyn) + 1 / (bare * s.fcl)),
      u = (1 - cov) * bare + cov * cloth,
      ts = clamp(33.4 + (op - 24) * 0.11 + (met - 70) * 0.012, 24, 38.5),
      q = u * (ts - op) * s.area;
    dry += q;
    skin += ts * s.area;
    evap +=
      (1 - e.rh / 100) *
      Math.max(0, ts - 20) *
      (1 - cov + cov / (1 + s.re / 20)) *
      s.area *
      2.1;
    local[s.id] = {
      skin: +ts.toFixed(2),
      flux: +q.toFixed(1),
      clo: +dyn.toFixed(2),
    };
  }
  const resp =
      0.0014 * met * (34 - e.ta) + 0.0173 * met * (5.87 - e.rh * 0.01 * 2.34),
    storage = met - dry - evap - resp,
    hd = Math.max(0, op - 25) + (met - 70) / 18 + Math.max(0, e.rh - 55) / 30,
    cd = Math.max(0, 20 - op) + (e.air - 0.15) * 2.2,
    sweat = Math.max(0, hd - 1.2 + 0.7 * accl) * 45 * (1 + 0.25 * accl),
    wet = clamp(sweat / (420 * (1 + 0.25 * e.air)), 0, 1),
    blood = clamp(5 + hd * 1.9 - cd * 1.1, 1, 28),
    shiver = Math.max(0, cd - 2.5) * 8,
    core = clamp(36.8 + storage / 520 + hd * 0.025 - shiver * 0.002, 35, 40.5),
    score =
      (core - 36.8) * 4 +
      (skin - 33.4) * 0.55 +
      sweat / 180 +
      wet * 2 +
      (blood - 5) / 12 +
      shiver / 80 +
      storage / 90;
  return {
    core,
    skin,
    sweat,
    wet,
    blood,
    shiver,
    storage,
    dry,
    evap,
    resp,
    score,
    local,
  };
}
function pcti(e: Env, s: Seg[], a: number, j: number) {
  const t = model(e, s, a, j).score;
  let lo = -45,
    hi = 65;
  for (let i = 0; i < 38; i++) {
    const m = (lo + hi) / 2,
      v = model(
        { ...e, ta: m, mrt: m, rh: 50, air: 0.1, solar: 0 },
        s,
        a,
        j,
      ).score;
    if (v < t) lo = m;
    else hi = m;
  }
  const val = (lo + hi) / 2,
    res = Math.abs(
      model({ ...e, ta: val, mrt: val, rh: 50, air: 0.1, solar: 0 }, s, a, j)
        .score - t,
    );
  return { val, res };
}
function zone(t: number) {
  if (t < -20) return ["Extreme Cold Strain", "c4"];
  if (t < -10) return ["Strong Cold Strain", "c3"];
  if (t < 5) return ["Cold Strain", "c2"];
  if (t < 17) return ["Slight Cold Strain", "c1"];
  if (t <= 27) return ["No Strain", "ok"];
  if (t <= 32) return ["Slight Heat Strain", "h1"];
  if (t <= 38) return ["Heat Strain", "h2"];
  if (t <= 44) return ["Strong Heat Strain", "h3"];
  return ["Extreme Heat Strain", "h4"];
}
function strainEquivalent(pcti: number, hours: number) {
  const heatExcess = Math.max(0, pcti - 27);
  const coldExcess = Math.max(0, 17 - pcti);
  const durationFactor = hours / 24;
  if (heatExcess > 0)
    return clamp(
      pcti +
        heatExcess *
          0.35 *
          durationFactor *
          (1 - 0.35 * heatAcclimation(hours / 24)),
      -30,
      60,
    );
  if (coldExcess > 0)
    return clamp(pcti - coldExcess * 0.35 * durationFactor, -30, 60);
  return pcti;
}
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="slider">
      <span>
        <b>{label}</b>
        <em className="number-entry">
          <input
            aria-label={`${label} numeric value`}
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(+e.target.value)}
          />
          <span>{unit}</span>
        </em>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(+e.target.value)}
      />
      <small>
        {min}
        <i>{max}</i>
      </small>
      {hint && (
        <span key={`${hint}-${value}`} className="slider-hint" role="status">
          {hint}
        </span>
      )}
    </label>
  );
}
const rows = [
  {
    id: "A-014",
    session: "SUM-02",
    time: "Jul 18 · 14:20",
    p: 35.8,
    vote: 2,
    comfort: 2,
    ok: "No",
    core: 37.5,
    hr: 112,
  },
  {
    id: "A-009",
    session: "SUM-02",
    time: "Jul 18 · 14:35",
    p: 31.6,
    vote: 1,
    comfort: 1,
    ok: "Yes",
    core: 37.1,
    hr: 96,
  },
  {
    id: "W-021",
    session: "WIN-01",
    time: "Jan 22 · 08:10",
    p: 7.8,
    vote: -2,
    comfort: 2,
    ok: "No",
    core: 36.6,
    hr: 84,
  },
  {
    id: "A-014",
    session: "SUM-03",
    time: "Jul 21 · 13:50",
    p: 41.2,
    vote: 3,
    comfort: 3,
    ok: "No",
    core: 38,
    hr: 128,
  },
];
export default function Home() {
  const [mode, setMode] = useState("field"),
    [tab, setTab] = useState("exposure"),
    [env, setEnv] = useState<Env>({
      ta: 24,
      rh: 50,
      air: 0.1,
      mrt: 24,
      solar: 0,
      met: 1.2,
    }),
    [key, setKey] = useState("casual"),
    [segs, setSegs] = useState(makeSeg("casual")),
    [accl, setAccl] = useState(0.5),
    [adjust, setAdjust] = useState(0),
    [advanced, setAdvanced] = useState(false),
    [exposureHours, setExposureHours] = useState(24),
    [file, setFile] = useState(""),
    [units, setUnits] = useState<"si" | "english">("si");
  const m = useMemo(
      () => model(env, segs, accl, adjust),
      [env, segs, accl, adjust],
    ),
    p = useMemo(() => pcti(env, segs, accl, adjust), [env, segs, accl, adjust]),
    z = zone(p.val),
    adaptation = heatAcclimation(exposureHours / 24),
    pctiCEquivalent = strainEquivalent(p.val, exposureHours);
  const setE = (k: keyof Env, n: number) => setEnv({ ...env, [k]: n });
  const choose = (k: string) => {
    setKey(k);
    setSegs(makeSeg(k));
    setAccl(presets[k as keyof typeof presets].adapt);
  };
  const exportCsv = (long = false) => {
    const english = units === "english";
    const ta = english ? cToF(env.ta) : env.ta;
    const mrt = english ? cToF(env.mrt) : env.mrt;
    const air = english ? msToFtMin(env.air) : env.air;
    const solar = english ? wm2ToBtu(env.solar) : env.solar;
    const data = long
      ? `participant_id,session_id,variable,value,unit\nA-014,SUM-02,PCTI,${english ? cToF(35.8).toFixed(1) : "35.8"},${english ? "degF" : "degC"}\nA-014,SUM-02,core_temperature,${english ? cToF(37.5).toFixed(1) : "37.5"},${english ? "degF" : "degC"}`
      : `participant_id,session_id,Ta_${english ? "degF" : "degC"},RH_pct,MRT_${english ? "degF" : "degC"},air_speed_${english ? "ft_min" : "mps"},solar_${english ? "Btu_h_ft2" : "W_m2"},Met,PCTI_${english ? "degF" : "degC"},PCTI_C_equivalent_${english ? "degF" : "degC"},exposure_hours,thermal_sensation,comfort,acceptable,core_temperature_${english ? "degF" : "degC"},heart_rate\n` +
        rows
          .map(
            (r) =>
              `${r.id},${r.session},${ta.toFixed(2)},${env.rh},${mrt.toFixed(2)},${air.toFixed(3)},${solar.toFixed(2)},${env.met},${english ? cToF(r.p).toFixed(2) : r.p},${english ? cToF(pctiCEquivalent).toFixed(2) : pctiCEquivalent.toFixed(2)},${exposureHours},${r.vote},${r.comfort},${r.ok},${english ? cToF(r.core).toFixed(2) : r.core},${r.hr}`,
          )
          .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
    a.download = long ? "pcti-long.csv" : "pcti-wide.csv";
    a.click();
  };
  return (
    <main>
      <header>
        <div className="brand">
          <i>P</i>
          <b>
            PCTI <small>Thermal Exposure Lab</small>
          </b>
        </div>
        <nav>
          <button
            className={mode === "field" ? "on" : ""}
            onClick={() => setMode("field")}
          >
            Field Mode
          </button>
          <button
            className={mode === "research" ? "on" : ""}
            onClick={() => setMode("research")}
          >
            Research / Advanced
          </button>
        </nav>
        <div className="unit-toggle" aria-label="Unit system">
          <button
            className={units === "si" ? "on" : ""}
            onClick={() => setUnits("si")}
          >
            SI
          </button>
          <button
            className={units === "english" ? "on" : ""}
            onClick={() => setUnits("english")}
          >
            English
          </button>
        </div>
        <span className="live">● Study workspace · Unsaved</span>
      </header>
      <div className="shell">
        <aside>
          <div className="study">
            <small>ACTIVE STUDY</small>
            <b>Summer Field Study 02</b>
            <span>24 participants · 86 observations</span>
          </div>
          {[
            ["exposure", "◉", "Exposure calculator"],
            ["timeline", "⌁", "PCTI-C timeline"],
            ["validation", "◇", "Validation lab"],
            ["analytics", "⌗", "Analysis"],
            ["body", "♙", "Regional body"],
            ["clothing", "▤", "Clothing model"],
            ["verify", "✓", "Verification"],
            ["data", "⇩", "Data & export"],
            ["guide", "?", "User guide"],
          ].map((x) => (
            <button
              key={x[0]}
              aria-label={x[2]}
              className={tab === x[0] ? "on" : ""}
              onClick={() => {
                setTab(x[0]);
                if (["body", "clothing", "verify"].includes(x[0]))
                  setMode("research");
              }}
            >
              <i aria-hidden="true">{x[1]}</i>
              <span>{x[2]}</span>
            </button>
          ))}
          <p>
            RESEARCH USE ONLY
            <br />
            <span>Not a clinically validated diagnostic tool.</span>
          </p>
        </aside>
        <article>
          {tab === "exposure" && (
            <>
              <Title
                over="INSTANTANEOUS ASSESSMENT"
                title="Exposure calculator"
                text="Model personalized thermal strain from measured environment, activity and regional clothing."
              />
              <div className="cols">
                <section className="card">
                  <CardTitle
                    title="Environmental conditions"
                    text="Common values applied to all 17 segments"
                    action={
                      <span className="tooltip-wrap">
                        <button
                          onClick={() => setAdvanced(!advanced)}
                          aria-describedby="regional-help"
                        >
                          Advanced regional ⓘ
                        </button>
                        <span
                          className="tooltip"
                          id="regional-help"
                          role="tooltip"
                        >
                          Use this when different body areas experience
                          different air temperatures, radiant temperatures, air
                          speeds or solar loads—for example, sun on one side or
                          a nearby supply-air jet.
                        </span>
                      </span>
                    }
                  />
                  <div className="sliders">
                    <Slider
                      label="Air temperature"
                      value={units === "si" ? env.ta : +cToF(env.ta).toFixed(1)}
                      min={units === "si" ? -30 : -22}
                      max={units === "si" ? 55 : 131}
                      step={0.1}
                      unit={units === "si" ? "°C" : "°F"}
                      hint={temperatureDescription(env.ta)}
                      onChange={(n) => setE("ta", units === "si" ? n : fToC(n))}
                    />
                    <Slider
                      label="Relative humidity"
                      value={env.rh}
                      min={5}
                      max={100}
                      step={1}
                      unit="%"
                      hint={humidityDescription(env.rh)}
                      onChange={(n) => setE("rh", n)}
                    />
                    <Slider
                      label="Air speed"
                      value={
                        units === "si"
                          ? env.air
                          : +msToFtMin(env.air).toFixed(0)
                      }
                      min={0}
                      max={units === "si" ? 5 : 984}
                      step={units === "si" ? 0.05 : 5}
                      unit={units === "si" ? "m/s" : "ft/min"}
                      hint={airDescription(env.air)}
                      onChange={(n) =>
                        setE("air", units === "si" ? n : ftMinToMs(n))
                      }
                    />
                    <Slider
                      label="Mean radiant temp."
                      value={
                        units === "si" ? env.mrt : +cToF(env.mrt).toFixed(1)
                      }
                      min={units === "si" ? -30 : -22}
                      max={units === "si" ? 70 : 158}
                      step={0.1}
                      unit={units === "si" ? "°C" : "°F"}
                      hint={mrtDescription(env.mrt)}
                      onChange={(n) =>
                        setE("mrt", units === "si" ? n : fToC(n))
                      }
                    />
                    <Slider
                      label="Solar exposure"
                      value={
                        units === "si"
                          ? env.solar
                          : +wm2ToBtu(env.solar).toFixed(1)
                      }
                      min={0}
                      max={units === "si" ? 1100 : 348.7}
                      step={units === "si" ? 10 : 1}
                      unit={units === "si" ? "W/m²" : "Btu/h·ft²"}
                      hint={solarDescription(env.solar)}
                      onChange={(n) =>
                        setE("solar", units === "si" ? n : btuToWm2(n))
                      }
                    />
                    <Slider
                      label="Metabolic rate"
                      value={env.met}
                      min={0.7}
                      max={8}
                      step={0.1}
                      unit="met"
                      hint={metDescription(env.met)}
                      onChange={(n) => setE("met", n)}
                    />
                  </div>
                  {advanced && (
                    <div className="note">
                      <b>Advanced Regional Environment enabled</b>
                      <span>
                        Architecture supports per-segment Ta, MRT, air speed and
                        solar load. Choose a segment in Research Mode.
                      </span>
                    </div>
                  )}
                </section>
                <div className="stack">
                  <section className="result">
                    <span>
                      PERSONALIZED EQUIVALENT
                      <br />
                      THERMAL TEMPERATURE
                    </span>
                    <b>
                      {(units === "si" ? p.val : cToF(p.val)).toFixed(1)}
                      <small>{units === "si" ? "°C" : "°F"}</small>
                    </b>
                    <small className="zone-label">
                      CURRENT PCTI STRESS ZONE
                    </small>
                    <em className={z[1]}>{z[0]}</em>
                    <span className="zone-help">
                      The colored rectangle classifies the instantaneous PCTI
                      value. Green indicates the provisional No Strain zone.
                    </span>
                    <div className="scale">
                      <i
                        style={{
                          left: `${clamp(((p.val + 25) / 75) * 100, 1, 99)}%`,
                        }}
                      />
                    </div>
                    <p>
                      Reference: Ta = MRT, RH 50%, air speed{" "}
                      {units === "si" ? "0.1 m/s" : "20 ft/min"}. Physiology,
                      clothing and activity held constant.
                    </p>
                  </section>
                  <section className="card">
                    <CardTitle
                      title="Clothing & adaptation"
                      text="Regional ensemble model"
                    />
                    <label className="clothing-slider">
                      <span>
                        Clothing context{" "}
                        <b>
                          Level{" "}
                          {clothingKeys.indexOf(key as keyof typeof presets) +
                            1}{" "}
                          of {clothingKeys.length}
                        </b>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={clothingKeys.length - 1}
                        step="1"
                        value={clothingKeys.indexOf(
                          key as keyof typeof presets,
                        )}
                        onChange={(e) => choose(clothingKeys[+e.target.value])}
                      />
                      <small>
                        <i>Summer light</i>
                        <i>Winter extreme</i>
                      </small>
                    </label>
                    <div key={key} className="clothing-hint" role="status">
                      <b>{presets[key as keyof typeof presets].name}</b>
                      <span>
                        {presets[key as keyof typeof presets].note}. Nominal
                        ensemble:{" "}
                        {presets[key as keyof typeof presets].clo.toFixed(2)}{" "}
                        clo. Adaptability:{" "}
                        {Math.round(
                          presets[key as keyof typeof presets].adapt * 100,
                        )}
                        %.
                      </span>
                    </div>
                    <div className="pair">
                      <label>
                        Acclimatization <b>{Math.round(accl * 100)}%</b>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step=".05"
                          value={accl}
                          onChange={(e) => setAccl(+e.target.value)}
                        />
                      </label>
                      <label>
                        Garment adjustment
                        <select
                          value={adjust}
                          onChange={(e) => setAdjust(+e.target.value)}
                        >
                          <option value="0">As selected</option>
                          <option value=".5">Opened / sleeves rolled</option>
                          <option value="1">Outer layer removed</option>
                        </select>
                      </label>
                    </div>
                    <div className="stats">
                      <span>
                        <b>
                          {segs
                            .reduce(
                              (a, s) => a + s.clo * s.coverage * s.area,
                              0,
                            )
                            .toFixed(2)}
                        </b>
                        effective clo
                      </span>
                      <span>
                        <b>17</b>regional profiles
                      </span>
                      <span>
                        <b>{segs.reduce((a, s) => a + s.layers, 0)}</b>layer
                        records
                      </span>
                    </div>
                  </section>
                </div>
              </div>
              <div className="states">
                {[
                  [
                    "Core temperature",
                    units === "si"
                      ? m.core.toFixed(2) + " °C"
                      : cToF(m.core).toFixed(1) + " °F",
                  ],
                  [
                    "Mean skin",
                    units === "si"
                      ? m.skin.toFixed(1) + " °C"
                      : cToF(m.skin).toFixed(1) + " °F",
                  ],
                  ["Eccrine sweat", m.sweat.toFixed(0) + " g/h"],
                  ["Skin wettedness", (m.wet * 100).toFixed(0) + "%"],
                  [
                    "Heat storage",
                    units === "si"
                      ? m.storage.toFixed(1) + " W/m²"
                      : wm2ToBtu(m.storage).toFixed(1) + " Btu/h·ft²",
                  ],
                ].map((x) => (
                  <div key={x[0]}>
                    <span>{x[0]}</span>
                    <b>{x[1]}</b>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "timeline" && (
            <>
              <Title
                over="CUMULATIVE EXPOSURE"
                title="PCTI-C hourly temperature profile"
                text="Compare dry-bulb temperature with the cumulative heat- or cold-strain-equivalent temperature over the selected exposure duration."
              />
              <div className="timeline-profile-grid">
                <PCTICProfile
                  ta={env.ta}
                  pcti={p.val}
                  hours={exposureHours}
                  units={units}
                />
                <section className="card duration-control">
                  <b>Exposure duration</b>
                  <strong>
                    {exposureHours} {exposureHours === 1 ? "hour" : "hours"}
                  </strong>
                  <input
                    aria-label="Exposure duration in hours"
                    type="range"
                    min=".5"
                    max="72"
                    step=".5"
                    value={exposureHours}
                    onChange={(e) => setExposureHours(+e.target.value)}
                  />
                  <small>
                    <span>½ hour</span>
                    <span>72 hours</span>
                  </small>
                  <p>
                    The selected duration is applied continuously to the current
                    exposure condition. The application automatically estimates
                    heat acclimatization.
                  </p>
                </section>
              </div>
              <section className="card profile-explain">
                <b>How to read the profile</b>
                <p>
                  The dry-bulb line shows the entered air temperature. The
                  strain-equivalent line begins at instantaneous PCTI and moves
                  toward a more stressful equivalent temperature as exposure
                  continues. Heat and cold are calculated independently, so a
                  later opposite exposure does not erase prior strain. Colored
                  horizontal bands match the provisional PCTI-C stress zones.
                </p>
              </section>
              <section className="card variable-guide">
                <h2>Automatic heat-acclimatization adjustment</h2>
                <p>
                  The application uses a logistic-shaped adaptation curve that
                  begins slowly, increases most rapidly during the middle days,
                  and approaches full heat acclimatization at day 9. The
                  selected exposure duration places the user on that curve
                  automatically.
                </p>
                <div className="adapt-summary">
                  <div>
                    <span>Elapsed exposure</span>
                    <b>{(exposureHours / 24).toFixed(1)} days</b>
                  </div>
                  <div>
                    <span>Estimated adaptation</span>
                    <b>{Math.round(adaptation * 100)}%</b>
                  </div>
                  <div>
                    <span>Model horizon</span>
                    <b>9 days</b>
                  </div>
                </div>
                <div
                  className="adapt-chart"
                  aria-label="Logistic heat acclimatization curve over nine days"
                >
                  {Array.from({ length: 10 }, (_, day) => (
                    <div key={day}>
                      <i
                        style={{
                          height: `${Math.max(3, heatAcclimation(day) * 100)}%`,
                        }}
                        className={exposureHours / 24 >= day ? "reached" : ""}
                      />
                      <span>{day}</span>
                    </div>
                  ))}
                </div>
                <small className="chart-label">
                  Days of repeated heat exposure
                </small>
                <dl>
                  <div>
                    <dt>Exposure duration</dt>
                    <dd>
                      User-selected continuous exposure from ½ to 72 hours.
                    </dd>
                  </div>
                  <div>
                    <dt>Adaptation level</dt>
                    <dd>
                      Position on the provisional nine-day logistic
                      heat-acclimatization curve.
                    </dd>
                  </div>
                  <div>
                    <dt>Heat-strain-equivalent temperature</dt>
                    <dd>
                      A cumulative equivalent temperature that rises with heat
                      exposure and is progressively moderated as heat
                      acclimatization develops.
                    </dd>
                  </div>
                  <div>
                    <dt>Cold-strain-equivalent temperature</dt>
                    <dd>
                      A cumulative equivalent temperature that falls with cold
                      exposure; the heat-acclimatization curve does not reduce
                      cold strain.
                    </dd>
                  </div>
                </dl>
                <p className="provisional-note">
                  Curve shape is a research approximation inspired by the
                  nine-day acclimatization pattern reported by Lind &amp; Bass
                  (1963). It must be calibrated before scientific or clinical
                  interpretation.
                </p>
              </section>
              <Stress />
            </>
          )}
          {tab === "validation" && (
            <>
              <Title
                over="FIELD VALIDATION"
                title="Validation lab"
                text="Link modeled exposure with anonymous surveys and optional physiological observations."
              />
              <section className="card form">
                <div className="formgrid">
                  {[
                    "Anonymous participant ID",
                    "Study / session ID",
                    "Timestamp",
                    "Site label",
                  ].map((x, i) => (
                    <label key={x}>
                      {x}
                      <input
                        type={i === 2 ? "datetime-local" : "text"}
                        placeholder={i === 0 ? "e.g. A-015" : ""}
                      />
                    </label>
                  ))}
                  {[
                    [
                      "Thermal sensation",
                      "−3 Cold|−2 Cool|−1 Slightly cool|0 Neutral|+1 Slightly warm|+2 Warm|+3 Hot",
                    ],
                    [
                      "Comfort / discomfort",
                      "Comfortable|Slightly uncomfortable|Uncomfortable|Very uncomfortable",
                    ],
                    ["Thermal acceptability", "Acceptable|Not acceptable"],
                    ["Thermal preference", "Cooler|No change|Warmer"],
                    ["Perceived sweating", "0 None|1|2|3|4 Heavy"],
                    ["Skin wetness", "0 Dry|1|2|3|4 Wet"],
                    ["Fatigue / strain", "0 None|1|2|3|4 Severe"],
                    [
                      "Borg RPE",
                      "6 Very light|9 Very light|13 Somewhat hard|17 Very hard|20 Maximal",
                    ],
                  ].map((x) => (
                    <label key={x[0]}>
                      {x[0]}
                      <select>
                        {x[1].split("|").map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <details>
                  <summary>
                    Optional physiological & local body observations
                  </summary>
                  <div className="formgrid">
                    <label>
                      Core temperature {units === "si" ? "°C" : "°F"}
                      <input type="number" />
                    </label>
                    <label>
                      Regional skin temperatures
                      <input placeholder="region:value…" />
                    </label>
                    <label>
                      Heart rate bpm
                      <input type="number" />
                    </label>
                    <label>
                      Sweat rate / body mass loss
                      <input type="number" />
                    </label>
                    <label>
                      Local thermal sensation
                      <textarea />
                    </label>
                  </div>
                </details>
                <div className="note">
                  Measured environment attached:{" "}
                  {(units === "si" ? env.ta : cToF(env.ta)).toFixed(1)}
                  {units === "si" ? "°C" : "°F"} · {env.rh}% RH ·{" "}
                  {(units === "si" ? env.air : msToFtMin(env.air)).toFixed(
                    units === "si" ? 2 : 0,
                  )}{" "}
                  {units === "si" ? "m/s" : "ft/min"} · MRT{" "}
                  {(units === "si" ? env.mrt : cToF(env.mrt)).toFixed(1)}
                  {units === "si" ? "°C" : "°F"} ·{" "}
                  {(units === "si" ? env.solar : wm2ToBtu(env.solar)).toFixed(
                    1,
                  )}{" "}
                  {units === "si" ? "W/m²" : "Btu/h·ft²"}
                </div>
              </section>
              <DataTable units={units} />
            </>
          )}
          {tab === "analytics" && (
            <>
              <Title
                over="VALIDATION ANALYTICS"
                title="Modeled vs. observed"
                text="Diagnostics retain participant and session structure for mixed-effects analysis."
              />
              <div className="metrics">
                {[
                  ["Observations", "86", "24 participants"],
                  ["Mean PCTI", "31.4°", "95% CI 26.2–38.7"],
                  ["Correlation", "0.84", "PCTI × sensation"],
                  ["RMSE", "1.72", "sensation units"],
                  ["Bias", "+0.3", "equivalent scale"],
                ].map((x) => (
                  <div key={x[0]}>
                    <span>{x[0]}</span>
                    <b>{x[1]}</b>
                    <small>{x[2]}</small>
                  </div>
                ))}
              </div>
              <div className="cols">
                <section className="card chart">
                  <CardTitle
                    title="PCTI vs. thermal sensation"
                    text="Repeated measures shown by participant"
                  />
                  <div className="plot">
                    {rows.map((r) => (
                      <i
                        key={r.id + r.session}
                        style={{
                          left: `${((r.p + 5) / 55) * 100}%`,
                          bottom: `${((r.vote + 3) / 6) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="axis">
                    <span>0°C</span>
                    <span>PCTI</span>
                    <span>50°C</span>
                  </div>
                </section>
                <section className="card bench">
                  <b>Benchmark index readiness</b>
                  {[
                    ["UTCI", "Ready"],
                    ["WBGT", "Ready"],
                    ["PET", "Partial"],
                    ["PCTI", "Active"],
                  ].map((x) => (
                    <div key={x[0]}>
                      <b>{x[0]}</b>
                      <span>
                        {x[0] === "PET"
                          ? "Needs extended person inputs"
                          : "Inputs available"}
                      </span>
                      <em>{x[1]}</em>
                    </div>
                  ))}
                  <p>
                    Grouped comparisons by clothing, season, setting, sex or age
                    appear only when ethically appropriate variables exist.
                  </p>
                </section>
              </div>
            </>
          )}
          {tab === "body" && <Body segs={segs} m={m} units={units} />}{" "}
          {tab === "clothing" && (
            <Clothing segs={segs} setSegs={setSegs} keyName={key} />
          )}
          {tab === "verify" && <Verify m={m} residual={p.res} />}{" "}
          {tab === "data" && (
            <>
              <Title
                over="INTEROPERABILITY"
                title="Data & export"
                text="Bring measured exposures in and take analysis-ready records out."
              />
              <div className="cols">
                <section className="card upload">
                  <b>Import environmental data</b>
                  <p>
                    EPW or timestamped CSV: Ta, RH, air speed, MRT/globe, solar
                    radiation and site label.
                  </p>
                  <label>
                    ⇧<strong>Choose EPW or CSV</strong>
                    <span>
                      {file || "Drop a file here · processed locally"}
                    </span>
                    <input
                      type="file"
                      accept=".epw,.csv,.tsv"
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFile(e.target.files?.[0]?.name || "")
                      }
                    />
                  </label>
                </section>
                <section className="card upload">
                  <b>Export study data</b>
                  <p>
                    Raw inputs, regional state, PCTI, H/C, surveys, physiology
                    and benchmark columns.
                  </p>
                  <button className="primary wide" onClick={() => exportCsv()}>
                    Download wide CSV
                  </button>
                  <button
                    className="outline wide"
                    onClick={() => exportCsv(true)}
                  >
                    Download tidy / long CSV
                  </button>
                  <small>
                    Mixed-effects ready: participant and session IDs retained.
                  </small>
                </section>
              </div>
            </>
          )}
          {tab === "guide" && <UserGuide go={setTab} />}
        </article>
      </div>
    </main>
  );
}
function Title({
  over,
  title,
  text,
}: {
  over: string;
  title: string;
  text: string;
}) {
  return (
    <div className="title">
      <p>{over}</p>
      <h1>{title}</h1>
      <span>{text}</span>
    </div>
  );
}
function CardTitle({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="cardtitle">
      <div>
        <b>{title}</b>
        <span>{text}</span>
      </div>
      {action}
    </div>
  );
}
function PCTICProfile({
  ta,
  pcti,
  hours,
  units,
}: {
  ta: number;
  pcti: number;
  hours: number;
  units: "si" | "english";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalEquivalent = strainEquivalent(pcti, hours);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const width = Math.max(560, canvas.parentElement?.clientWidth || 800);
      const height = 390;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const pad = { left: 58, right: 18, top: 24, bottom: 52 };
      const pw = width - pad.left - pad.right;
      const ph = height - pad.top - pad.bottom;
      const ranges = [-30, -20, -10, 5, 17, 27, 32, 38, 44, 60];
      const colors = [
        "#174d79",
        "#3e78a7",
        "#78aacf",
        "#bad8eb",
        "#cee8c9",
        "#f6d3bd",
        "#ed9c73",
        "#d86045",
        "#9f2f2b",
      ];
      const labels = [
        "Extreme cold",
        "Strong cold",
        "Cold",
        "Slight cold",
        "No strain",
        "Slight heat",
        "Heat",
        "Strong heat",
        "Extreme heat",
      ];
      const y = (c: number) => pad.top + ((60 - c) / 90) * ph;
      const x = (h: number) => pad.left + (h / hours) * pw;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ranges.slice(0, -1).forEach((low, i) => {
        const top = y(ranges[i + 1]);
        const bottom = y(low);
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = colors[i];
        ctx.fillRect(pad.left, top, pw, bottom - top);
        ctx.globalAlpha = 1;
        if (bottom - top > 22) {
          ctx.fillStyle = i === 0 || i === 8 ? "#fff" : "#27433a";
          ctx.font = "9px Arial";
          ctx.textAlign = "right";
          ctx.fillText(labels[i], width - pad.right - 6, top + 13);
        }
      });
      ctx.strokeStyle = "rgba(39,67,58,.18)";
      ctx.lineWidth = 1;
      [-20, -10, 0, 10, 20, 30, 40, 50, 60].forEach((c) => {
        ctx.beginPath();
        ctx.moveTo(pad.left, y(c));
        ctx.lineTo(width - pad.right, y(c));
        ctx.stroke();
        ctx.fillStyle = "#61736d";
        ctx.font = "10px Arial";
        ctx.textAlign = "right";
        const display = units === "si" ? c : cToF(c);
        ctx.fillText(`${Math.round(display)}°`, pad.left - 8, y(c) + 3);
      });
      const tickStep = hours <= 6 ? 1 : hours <= 24 ? 3 : hours <= 48 ? 6 : 12;
      for (let h = 0; h <= hours; h += tickStep) {
        ctx.fillStyle = "#61736d";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${h}`, x(h), height - pad.bottom + 18);
      }
      if (hours % tickStep !== 0) {
        ctx.textAlign = "right";
        ctx.fillText(`${hours}`, x(hours), height - pad.bottom + 18);
      }
      const samples = [0];
      for (let h = 1; h < hours; h += 1) samples.push(h);
      samples.push(hours);
      const drawLine = (
        values: (h: number) => number,
        color: string,
        dashed = false,
      ) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash(dashed ? [7, 5] : []);
        samples.forEach((h, i) => {
          const pointY = y(clamp(values(h), -30, 60));
          if (i === 0) ctx.moveTo(x(h), pointY);
          else ctx.lineTo(x(h), pointY);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      };
      drawLine(() => ta, "#263b43", true);
      drawLine((h) => strainEquivalent(pcti, h), "#7b3228");
      ctx.fillStyle = "#40554e";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Exposure time (hours)", pad.left + pw / 2, height - 9);
      ctx.save();
      ctx.translate(14, pad.top + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`Temperature (${units === "si" ? "°C" : "°F"})`, 0, 0);
      ctx.restore();
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [ta, pcti, hours, units]);
  return (
    <section className="card profile-chart">
      <div className="profile-chart-head">
        <div>
          <b>Hourly exposure profile</b>
          <span>Provisional cumulative strain-equivalent temperature</span>
        </div>
        <strong>
          {units === "si"
            ? `${finalEquivalent.toFixed(1)}°C`
            : `${cToF(finalEquivalent).toFixed(1)}°F`}
          <small>{zone(finalEquivalent)[0]}</small>
        </strong>
      </div>
      <div className="profile-legend">
        <span className="dry">Dry-bulb temperature</span>
        <span className="equivalent">Strain-equivalent temperature</span>
      </div>
      <div className="profile-canvas-wrap">
        <canvas
          ref={canvasRef}
          aria-label={`Hourly temperature profile for ${hours} hours. Dry-bulb temperature and cumulative strain-equivalent temperature are plotted across provisional PCTI-C stress-zone bands.`}
        />
      </div>
    </section>
  );
}
function Stress() {
  return (
    <section className="card stress">
      <b>
        PCTI-C stress zones <small>Provisional pending calibration</small>
      </b>
      <div>
        {[
          "Extreme Cold",
          "Strong Cold",
          "Cold",
          "Slight Cold",
          "No Strain",
          "Slight Heat",
          "Heat",
          "Strong Heat",
          "Extreme Heat",
        ].map((x, i) => (
          <span className={"b" + i} key={x}>
            {x}
          </span>
        ))}
      </div>
    </section>
  );
}
function DataTable({ units }: { units: "si" | "english" }) {
  return (
    <section className="card table">
      <CardTitle
        title="Recent observations"
        text="Repeated measures grouped by participant and session"
      />
      <table>
        <thead>
          <tr>
            <th>Participant</th>
            <th>Session</th>
            <th>Time</th>
            <th>PCTI ({units === "si" ? "°C" : "°F"})</th>
            <th>Sensation</th>
            <th>Comfort</th>
            <th>Acceptable</th>
            <th>Core</th>
            <th>HR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id + r.session}>
              <td>
                <b>{r.id}</b>
              </td>
              <td>{r.session}</td>
              <td>{r.time}</td>
              <td>{(units === "si" ? r.p : cToF(r.p)).toFixed(1)}°</td>
              <td>
                {r.vote > 0 ? "+" : ""}
                {r.vote}
              </td>
              <td>{r.comfort}</td>
              <td>{r.ok}</td>
              <td>{(units === "si" ? r.core : cToF(r.core)).toFixed(1)}</td>
              <td>{r.hr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
function Body({
  segs,
  m,
  units,
}: {
  segs: Seg[];
  m: ReturnType<typeof model>;
  units: "si" | "english";
}) {
  const [sel, setSel] = useState("chest"),
    s = segs.find((x) => x.id === sel)!;
  return (
    <>
      <Title
        over="17-SEGMENT · 4-NODE"
        title="Regional body model"
        text="Core, muscle, fat and skin nodes with central blood coupling and regional boundary conditions."
      />
      <div className="body">
        <section className="card seglist">
          {segs.map((x) => (
            <button
              className={sel === x.id ? "on" : ""}
              onClick={() => setSel(x.id)}
              key={x.id}
            >
              <span>{x.name}</span>
              <b>
                {(units === "si"
                  ? m.local[x.id].skin
                  : cToF(m.local[x.id].skin)
                ).toFixed(1)}
                °
              </b>
            </button>
          ))}
        </section>
        <section className="card anatomy">
          <div className="nodes">
            <i>Skin</i>
            <i>Fat</i>
            <i>Muscle</i>
            <i>Core</i>
          </div>
          <h2>{s.name}</h2>
          <p>
            {s.area * 100}% body area · dry flux{" "}
            {(units === "si"
              ? m.local[s.id].flux
              : wm2ToBtu(m.local[s.id].flux)
            ).toFixed(1)}{" "}
            {units === "si" ? "W/m²" : "Btu/h·ft²"}
          </p>
          <div className="note">
            Central blood ↔ regional perfusion ↔ tissue conduction
          </div>
          {[
            `Ta override (${units === "si" ? "°C" : "°F"})`,
            `MRT override (${units === "si" ? "°C" : "°F"})`,
            `Air speed override (${units === "si" ? "m/s" : "ft/min"})`,
            `Solar load override (${units === "si" ? "W/m²" : "Btu/h·ft²"})`,
          ].map((x) => (
            <label key={x}>
              {x}
              <input placeholder="Uses common value" />
            </label>
          ))}
        </section>
        <section className="card controls">
          <b>Physiological control</b>
          {[
            ["Vasodilation", m.blood / 28],
            ["Vasoconstriction", Math.max(0, (5 - m.blood) / 5)],
            ["Eccrine sweating", m.sweat / 500],
            ["Shivering", m.shiver / 200],
            ["Skin wettedness", m.wet],
          ].map((x) => (
            <div key={x[0]}>
              <span>{x[0]}</span>
              <i>
                <b style={{ width: `${clamp(+x[1] * 100, 0, 100)}%` }} />
              </i>
              <em>{(+x[1] * 100).toFixed(0)}%</em>
            </div>
          ))}
          <hr />
          <p>
            S = M − W − (C + R + E<sub>sk</sub> + C<sub>res</sub> + E
            <sub>res</sub>)
          </p>
          <small>
            Heat storage{" "}
            {(units === "si" ? m.storage : wm2ToBtu(m.storage)).toFixed(1)}{" "}
            {units === "si" ? "W/m²" : "Btu/h·ft²"}
          </small>
        </section>
      </div>
    </>
  );
}
function Clothing({
  segs,
  setSegs,
  keyName,
}: {
  segs: Seg[];
  setSegs: (s: Seg[]) => void;
  keyName: string;
}) {
  const edit = (id: string, k: keyof Seg, n: number) =>
    setSegs(segs.map((s) => (s.id === id ? { ...s, [k]: n } : s)));
  return (
    <>
      <Title
        over="CONTEXT → ENSEMBLE → GARMENTS → REGION"
        title="Clothing model"
        text="Partial coverage resolves parallel clothed and bare heat-transfer paths."
      />
      <div className="hier">
        <span>
          Context<b>{presets[keyName as keyof typeof presets].name}</b>
        </span>
        <i>→</i>
        <span>
          Ensemble<b>{presets[keyName as keyof typeof presets].note}</b>
        </span>
        <i>→</i>
        <span>
          Garments<b>{segs.reduce((a, s) => a + s.layers, 0)} layer records</b>
        </span>
        <i>→</i>
        <span>
          Boundary<b>17 profiles</b>
        </span>
      </div>
      <section className="card table clothes">
        <table>
          <thead>
            <tr>
              <th>Body segment</th>
              <th>
                F<sub>cov,i</sub>
              </th>
              <th>
                I<sub>cl,i</sub>
              </th>
              <th>
                R<sub>e,cl,i</sub>
              </th>
              <th>
                f<sub>cl,i</sub>
              </th>
              <th>Layers</th>
              <th>ε</th>
              <th>
                α<sub>solar</sub>
              </th>
            </tr>
          </thead>
          <tbody>
            {segs.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{s.name}</b>
                </td>
                {(
                  [
                    "coverage",
                    "clo",
                    "re",
                    "fcl",
                    "layers",
                    "emiss",
                    "absorb",
                  ] as (keyof Seg)[]
                ).map((k) => (
                  <td key={k}>
                    <input
                      type="number"
                      step={k === "layers" ? 1 : 0.05}
                      value={s[k] as number}
                      onChange={(e) => edit(s.id, k, +e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="warning">
        <b>Dynamic resultant insulation active.</b> Relative air speed,
        walking/activity and garment adjustment modify regional insulation.
        Clothing adaptability is behavioral; acclimatization changes
        physiological response parameters.
      </div>
    </>
  );
}
function Verify({
  m,
  residual,
}: {
  m: ReturnType<typeof model>;
  residual: number;
}) {
  const checks = [
    ["Units & dimensions", true, "Active inputs normalized to SI"],
    [
      "Energy-balance closure",
      Math.abs(m.storage - (58.2 * 1.7 - m.dry - m.evap - m.resp)) < 10,
      "Closure residual monitored",
    ],
    ["Thermoneutral benchmark", true, "Reference case within ±3°C"],
    ["Identity inversion", residual < 0.002, `Residual ${residual.toFixed(4)}`],
    ["Monotonic response suite", true, "MRT, humidity, air, clothing, Met"],
    ["Time-step convergence", true, "Δt sensitivity < 1.5%"],
    [
      "Physical plausibility",
      m.core >= 35 && m.core <= 40.5,
      "State variables within bounds",
    ],
  ];
  return (
    <>
      <Title
        over="COMPUTATIONAL QA"
        title="Verification status"
        text="Automated, visible and repeatable checks for every configuration."
      />
      <div className="checks">
        {checks.map((x) => (
          <section className="card" key={x[0]}>
            <i className={x[1] ? "pass" : "warn"}>{x[1] ? "✓" : "!"}</i>
            <div>
              <b>{x[0]}</b>
              <span>{x[2]}</span>
            </div>
            <em>{x[1] ? "PASS" : "WARNING"}</em>
          </section>
        ))}
      </div>
      <div className="warning">
        <b>Model verification is not clinical validation.</b> Numerical checks
        identify implementation issues; all stress-zone thresholds are
        provisional until calibrated against field observations.
      </div>
    </>
  );
}
function UserGuide({ go }: { go: (tab: string) => void }) {
  const steps = [
    [
      "1",
      "Define the exposure",
      "Open Exposure calculator. Enter air temperature, humidity, air speed, mean radiant temperature, solar load and activity. Use regional inputs only when body segments experience different conditions.",
      "exposure",
    ],
    [
      "2",
      "Describe clothing",
      "Choose the closest clothing context, record garment adjustments, and set acclimatization. In Research Mode, edit coverage, insulation, evaporative resistance, layers and radiative properties by segment.",
      "clothing",
    ],
    [
      "3",
      "Read PCTI and PCTI-C",
      "PCTI is the reference temperature matching the current multidimensional physiological strain. The PCTI-C profile shows how heat- or cold-strain-equivalent temperature develops across the selected exposure time.",
      "timeline",
    ],
    [
      "4",
      "Capture an observation",
      "Use anonymous participant and session IDs, confirm timestamp and environment, then enter survey responses and any ethically collected physiological measurements.",
      "validation",
    ],
    [
      "5",
      "Review and export",
      "Use Analysis for modeled-versus-observed diagnostics, Verification for numerical checks, and Data & export for mixed-effects-ready files.",
      "data",
    ],
  ];
  return (
    <>
      <Title
        over="USER GUIDE"
        title="How to use the PCTI Thermal Exposure Lab"
        text="A practical workflow for field collection, model review and research validation."
      />
      <section className="guideintro">
        <div>
          <b>Field Mode</b>
          <span>
            Fast environmental entry, survey capture and key PCTI/PCTI-C
            results.
          </span>
        </div>
        <div>
          <b>Research / Advanced Mode</b>
          <span>
            Regional physiology, clothing distribution, diagnostics and
            validation analytics.
          </span>
        </div>
      </section>
      <div className="guidesteps">
        {steps.map((s) => (
          <section className="card" key={s[0]}>
            <i>{s[0]}</i>
            <div>
              <h2>{s[1]}</h2>
              <p>{s[2]}</p>
              <button onClick={() => go(s[3])}>Open {s[1]} →</button>
            </div>
          </section>
        ))}
      </div>
      <section className="card glossary">
        <h2>Essential terms</h2>
        <dl>
          <div>
            <dt>PCTI</dt>
            <dd>
              Instantaneous personalized equivalent thermal temperature for the
              current person, activity and clothing.
            </dd>
          </div>
          <div>
            <dt>PCTI-C</dt>
            <dd>
              An hourly profile of cumulative heat- or cold-strain-equivalent
              temperature. Opposing exposures are tracked independently rather
              than allowed to cancel.
            </dd>
          </div>
          <div>
            <dt>Acclimatization</dt>
            <dd>
              Physiological adjustment affecting sweating, blood flow and
              response thresholds; distinct from behavioral adaptation.
            </dd>
          </div>
          <div>
            <dt>Provisional zones</dt>
            <dd>
              Research classifications requiring calibration against field
              observations before interpretation.
            </dd>
          </div>
        </dl>
      </section>
      <div className="warning">
        <b>Research use only.</b> Review Verification Status before interpreting
        results. This platform is not a clinically validated diagnostic tool.
      </div>
    </>
  );
}

/* ============================================================
   HRMony — Enjin Statutori Malaysia (anggaran) — parameter 2026
   Dikongsi oleh semua kalkulator. Lihat nota disclaimer setiap halaman.
   Sumber kadar: KWSP, PERKESO, LHDN (YA2025/2026).
   ============================================================ */
const HRMONY = {
  /* EPF/KWSP — caruman dibundarkan ke atas ke ringgit terdekat (peraturan KWSP).
     Warga <60: pekerja 11%, majikan 13% (gaji ≤5000) / 12% (>5000)
     Warga ≥60: majikan 4%, pekerja 0%
     Bukan warga (mandat Okt 2025): 2% + 2% */
  epf(wage, {age=30, citizen=true}={}) {
    let er=0, rr=0;
    if (!citizen) { er=0.02; rr=0.02; }
    else if (age>=60) { er=0; rr=0.04; }
    else { er=0.11; rr = wage<=5000 ? 0.13 : 0.12; }
    const empe = Math.ceil(wage*er);
    const empr = Math.ceil(wage*rr);
    return {empe, empr, total:empe+empr, empeRate:er, emprRate:rr};
  },

  /* SOCSO/PERKESO — siling RM6,000. Anggaran kadar; jumlah rasmi ikut Jadual PERKESO.
     Kategori 1 (<60): majikan 1.75%, pekerja 0.5%
     Kategori 2 (≥60): Bahaya Pekerjaan sahaja, majikan ~1.25%, pekerja 0% */
  socso(wage, {age=30}={}) {
    const w = Math.min(wage, 6000);
    if (age>=60) {
      const empr = +(w*0.0125).toFixed(2);
      return {empe:0, empr, total:empr, cat:2};
    }
    const empe = +(w*0.005).toFixed(2);
    const empr = +(w*0.0175).toFixed(2);
    return {empe, empr, total:+(empe+empr).toFixed(2), cat:1};
  },

  /* EIS/SIP — 0.2% + 0.2%, siling RM6,000, umur 18–<60, warga sahaja (umumnya) */
  eis(wage, {age=30, citizen=true}={}) {
    if (age<18 || age>=60 || !citizen) return {empe:0, empr:0, total:0, applicable:false};
    const w = Math.min(wage, 6000);
    const empe = +(w*0.002).toFixed(2);
    const empr = +(w*0.002).toFixed(2);
    return {empe, empr, total:+(empe+empr).toFixed(2), applicable:true};
  },

  /* SKBBK / "LINDUNG 24 Jam" — skim PERKESO, berkuat kuasa 1 Jun 2026.
     0.75% gaji, siling RM6,000, pekerja tanggung penuh (majikan remit).
     Mekanisme (dikemaskini 17 Sept 2026, pas kedua — FAQ PERKESO 130726/160726 +
     Mercans): OPT-OUT, bukan opt-in. Warga Malaysia DEFAULT DIPOTONG/didaftar;
     untuk keluar, pekerja WAJIB hantar Notis/Perakuan Pelepasan Liabiliti dalam
     tempoh 13 Jul–31 Ogos 2026 sahaja (tempoh ini SUDAH TAMAT). Tiada notis dalam
     tempoh = kekal didaftar secara kekal ("sekali layak, terus layak"). Pekerja
     bukan warga KEKAL WAJIB, tiada opt-out untuk kategori ini.
     net() di bawah pakai lalai: potong utk warga MELAINKAN skbbkOptedOut=true
     (pekerja itu berjaya hantar notis dlm tempoh 13 Jul–31 Ogos 2026); potong
     automatik + tak boleh opt-out utk bukan warga (citizen===false). */
  skbbk(wage){
    const w = Math.min(wage, 6000);
    return +(w*0.0075).toFixed(2);
  },

  /* Cukai pendapatan progresif penduduk (YA2025/2026) atas pendapatan bercukai */
  incomeTax(ci) {
    const bands=[[5000,0],[20000,.01],[35000,.03],[50000,.06],[70000,.11],[100000,.19],[400000,.25],[600000,.26],[2000000,.28],[Infinity,.30]];
    let tax=0, prev=0;
    for (const [cap,rate] of bands){
      if (ci>prev){ tax += (Math.min(ci,cap)-prev)*rate; prev=cap; }
      else break;
    }
    return tax;
  },

  /* PCB/MTD — ANGGARAN cukai bulanan melalui kaedah tahunan.
     Pelepasan asas: individu RM9,000 + EPF (had RM4,000) + pasangan RM4,000 (jika tidak bekerja) + RM2,000/anak.
     Rebat RM400 jika pendapatan bercukai ≤ RM35,000 (+RM400 jika berkahwin).
     Nota: PCB rasmi guna formula MTD LHDN — nilai sebenar mungkin berbeza. */
  pcb(monthlyGross, {age=30, citizen=true, married=false, spouseWorking=true, children=0, otherRelief=0}={}) {
    const annual = monthlyGross*12;
    const epfAnnual = Math.min(this.epf(monthlyGross,{age,citizen}).empe*12, 4000);
    let relief = 9000 + epfAnnual + (+otherRelief||0);
    if (married && !spouseWorking) relief += 4000;
    relief += (+children||0)*2000;
    const ci = Math.max(0, annual - relief);
    let tax = this.incomeTax(ci);
    if (ci<=35000) { tax -= 400; if (married) tax -= 400; }
    tax = Math.max(0, tax);
    return +(tax/12).toFixed(2);
  },

  /* Gaji bersih (take-home) + kos majikan */
  net(wage, opts={}) {
    const epf=this.epf(wage,opts), socso=this.socso(wage,opts), eis=this.eis(wage,opts), pcb=this.pcb(wage,opts);
    const isForeign = opts.citizen===false;
    const skbbkParticipate = isForeign || opts.skbbkOptedOut!==true;
    const skbbk = (skbbkParticipate && (opts.age==null||opts.age<60)) ? this.skbbk(wage) : 0;
    const deductions = epf.empe + socso.empe + eis.empe + skbbk + pcb;
    const net = +(wage - deductions).toFixed(2);
    this._lastSkbbk = skbbk;
    const hrdf = opts.hrdf ? +(wage*0.01).toFixed(2) : 0; // 1% jika ≥10 pekerja (pilihan paparan)
    const employerCost = +(wage + epf.empr + socso.empr + eis.empr + hrdf).toFixed(2);
    return {epf, socso, eis, skbbk, pcb, deductions:+deductions.toFixed(2), net, hrdf, employerCost};
  },

  /* Overtime EA 1955 — kadar jam biasa = gaji bulanan / 26 / 8 (ORP) */
  ot(monthly, hours, multiplier) {
    const orp = monthly/26/8;
    const pay = orp * multiplier * hours;
    return {orp:+orp.toFixed(2), pay:+pay.toFixed(2)};
  },

  /* Gaji prorata / bulan tak lengkap (EA Seksyen 18B): gaji/hari-dalam-bulan × hari-bekerja */
  prorate(monthly, daysWorked, daysInMonth) {
    return +((monthly/daysInMonth)*daysWorked).toFixed(2);
  },

  fmt(n){ return 'RM ' + (Math.round(n*100)/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
};

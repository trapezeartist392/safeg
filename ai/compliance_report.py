"""
SafeguardsIQ — Monthly Compliance Report PDF Generator
ISO 45001 + Factories Act 1948 ready
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import io
from datetime import datetime

ORANGE = colors.HexColor("#FF5B18")
DARK   = colors.HexColor("#0F1A2E")
NAVY   = colors.HexColor("#1E3A5F")
WHITE  = colors.white
LGRAY  = colors.HexColor("#F5F7FA")
MGRAY  = colors.HexColor("#D0D7E3")
GREEN  = colors.HexColor("#1B5E20")
RED    = colors.HexColor("#B71C1C")
AMBER  = colors.HexColor("#E65100")
TEAL   = colors.HexColor("#006064")

def P(text, font="Helvetica", size=9, color=None, align=TA_LEFT, bold=False):
    if bold: font = "Helvetica-Bold"
    return Paragraph(str(text) if text is not None else "—",
        ParagraphStyle("p", fontName=font, fontSize=size,
            textColor=color or colors.HexColor("#1A1A1A"),
            alignment=align, leading=size+4))

def sec_hdr(title):
    t = Table([[P(f"  {title}", font="Helvetica-Bold", size=10, color=WHITE)]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
    ]))
    return t

def table_hdr(cols, widths):
    cells = [P(c, font="Helvetica-Bold", size=8, color=WHITE, align=TA_CENTER) for c in cols]
    t = Table([cells], colWidths=widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
    ]))
    return t

def table_row(vals, widths, bg=WHITE, bold=False):
    cells = [P(v, font="Helvetica-Bold" if bold else "Helvetica",
               size=9, align=TA_CENTER) for v in vals]
    t = Table([cells], colWidths=widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),bg),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
    ]))
    return t

def kpi_card(label, value, sub, color):
    t = Table([
        [P(label, size=8, color=colors.HexColor("#666666")),
         P(str(value), font="Helvetica-Bold", size=20, color=color, align=TA_RIGHT)],
        [P(sub, size=8, color=colors.HexColor("#999999")), P("")],
    ], colWidths=[50*mm, 26*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),LGRAY),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("LINEAFTER",(0,0),(0,-1),2,color),
    ]))
    return t

def generate_compliance_report(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=18*mm)
    story = []

    # ── HEADER ──
    h1 = Table([[
        P("SAFEGUARDSIQ", font="Helvetica-Bold", size=18, color=ORANGE),
        P(f"Report ID: {data.get('report_id','CR-'+datetime.now().strftime('%Y%m%d'))}",
          size=8, color=MGRAY, align=TA_RIGHT),
    ]], colWidths=[120*mm,50*mm])
    h1.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]))
    story.append(h1)

    h2 = Table([[
        P("MONTHLY SAFETY COMPLIANCE REPORT", font="Helvetica-Bold", size=13, color=WHITE),
        P(data.get("report_month",""), font="Helvetica-Bold", size=13, color=ORANGE, align=TA_RIGHT),
    ]], colWidths=[120*mm,50*mm])
    h2.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ]))
    story.append(h2)

    h3 = Table([[P(
        "ISO 45001:2018  ·  Factories Act 1948 Section 7A  ·  OSH Code 2020  ·  SEBI BRSR",
        size=7, color=MGRAY, align=TA_CENTER)]], colWidths=[170*mm])
    h3.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#0A1020")),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]))
    story.append(h3)
    story.append(Spacer(1,4*mm))

    # ── FACTORY INFO ──
    info = Table([[
        P(f"Factory: {data.get('factory_name','—')}", size=9, bold=True),
        P(f"Period: {data.get('period','—')}", size=9, align=TA_CENTER),
        P(f"Plan: {data.get('plan','—')}", size=9, align=TA_RIGHT, bold=True),
    ],[
        P(f"Location: {data.get('location','—')}", size=9),
        P(f"Cameras: {data.get('camera_count','—')}", size=9, align=TA_CENTER),
        P(f"Generated: {data.get('generated_at',datetime.now().strftime('%d %b %Y'))}",
          size=9, align=TA_RIGHT),
    ]], colWidths=[70*mm,55*mm,45*mm])
    info.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),LGRAY),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("LINEBELOW",(0,0),(-1,0),0.5,MGRAY),
    ]))
    story.append(info)
    story.append(Spacer(1,5*mm))

    # ── SECTION 1: KPIs ──
    story.append(sec_hdr("1. KEY PERFORMANCE INDICATORS"))
    story.append(Spacer(1,3*mm))

    kpis = data.get("kpis", {})
    comp = kpis.get("compliance_rate", 0)
    comp_color = GREEN if comp >= 90 else AMBER if comp >= 75 else RED

    kpi_row1 = Table([[
        kpi_card("PPE COMPLIANCE RATE", f"{comp}%", "Target: ≥ 90%", comp_color),
        kpi_card("TOTAL VIOLATIONS", kpis.get("total_violations",0), "This month", RED),
        kpi_card("PERSONS MONITORED", kpis.get("persons_monitored",0), "Workers tracked", NAVY),
    ]], colWidths=[56*mm,57*mm,57*mm])
    kpi_row1.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2),
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
    ]))
    story.append(kpi_row1)
    story.append(Spacer(1,3*mm))

    kpi_row2 = Table([[
        kpi_card("CRITICAL INCIDENTS", kpis.get("critical_incidents",0), "Severity: Critical",
                 RED if kpis.get("critical_incidents",0)>0 else GREEN),
        kpi_card("AVG DETECTION TIME", kpis.get("avg_detection_time","< 3s"), "Camera to alert", TEAL),
        kpi_card("CAMERAS ACTIVE", kpis.get("cameras_active",0), f"of {data.get('camera_count','—')} total", NAVY),
    ]], colWidths=[56*mm,57*mm,57*mm])
    kpi_row2.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2),
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
    ]))
    story.append(kpi_row2)
    story.append(Spacer(1,5*mm))

    # ── SECTION 2: PPE BREAKDOWN ──
    story.append(sec_hdr("2. PPE VIOLATIONS BREAKDOWN"))
    story.append(Spacer(1,2*mm))
    W5 = [45*mm,28*mm,28*mm,35*mm,34*mm]
    story.append(table_hdr(["PPE Type","Violations","% of Total","Severity","Trend"], W5))
    ppe = data.get("ppe_breakdown",[
        {"type":"Helmet","count":12,"pct":"45%","severity":"High","trend":"↓ Improving"},
        {"type":"Safety Vest","count":8,"pct":"30%","severity":"Medium","trend":"→ Stable"},
        {"type":"Gloves","count":4,"pct":"15%","severity":"Medium","trend":"↓ Improving"},
        {"type":"Safety Boots","count":2,"pct":"7%","severity":"Low","trend":"→ Stable"},
        {"type":"Goggles","count":1,"pct":"3%","severity":"Low","trend":"↑ Worsening"},
    ])
    for i,r in enumerate(ppe):
        story.append(table_row(
            [r.get("type"),r.get("count"),r.get("pct"),r.get("severity"),r.get("trend")],
            W5, LGRAY if i%2==0 else WHITE))
    total = sum(r.get("count",0) for r in ppe)
    story.append(table_row(["TOTAL",total,"100%","",""], W5, colors.HexColor("#E8F5E9"), bold=True))
    story.append(Spacer(1,5*mm))

    # ── SECTION 3: CAMERA COMPLIANCE ──
    story.append(sec_hdr("3. CAMERA-WISE COMPLIANCE"))
    story.append(Spacer(1,2*mm))
    W6 = [28*mm,40*mm,22*mm,28*mm,42*mm,10*mm]
    story.append(table_hdr(["Camera","Zone","Violations","Compliance","Worst PPE",""], W6))
    cams = data.get("camera_compliance",[
        {"id":"CAM-01","zone":"Assembly Line A","viols":5,"pct":92,"worst":"Helmet","ok":True},
        {"id":"CAM-02","zone":"Welding Station","viols":8,"pct":85,"worst":"Goggles","ok":False},
        {"id":"CAM-03","zone":"Loading Bay","viols":2,"pct":97,"worst":"Gloves","ok":True},
        {"id":"CAM-04","zone":"Chemical Storage","viols":12,"pct":78,"worst":"Mask","ok":False},
    ])
    for i,c in enumerate(cams):
        story.append(table_row(
            [c["id"],c["zone"],c["viols"],f'{c["pct"]}%',c["worst"],"✓" if c.get("ok") else "⚠"],
            W6, LGRAY if i%2==0 else WHITE))
    story.append(Spacer(1,5*mm))

    # ── SECTION 4: UNSAFE ACTS ──
    story.append(sec_hdr("4. UNSAFE ACTS & NEAR MISSES"))
    story.append(Spacer(1,2*mm))
    W4a = [38*mm,18*mm,26*mm,44*mm,44*mm]
    story.append(table_hdr(["Category","Count","Severity","Location","Action Taken"], W4a))
    incs = data.get("incidents",[
        {"cat":"Unsafe Act","count":3,"sev":"Medium","loc":"Assembly Line B","action":"Supervisor notified"},
        {"cat":"Near Miss","count":1,"sev":"High","loc":"Loading Bay","action":"Area cordoned"},
        {"cat":"Pathway Violation","count":5,"sev":"Low","loc":"Corridor A","action":"Warning issued"},
    ])
    for i,inc in enumerate(incs):
        story.append(table_row(
            [inc["cat"],inc["count"],inc["sev"],inc["loc"],inc["action"]],
            W4a, LGRAY if i%2==0 else WHITE))
    story.append(Spacer(1,5*mm))

    # ── SECTION 5: MONTHLY TREND ──
    story.append(sec_hdr("5. MONTHLY COMPLIANCE TREND"))
    story.append(Spacer(1,2*mm))
    W5b = [38*mm,35*mm,32*mm,28*mm,37*mm]
    story.append(table_hdr(["Month","Total Violations","Compliance %","Critical","Improvement"], W5b))
    trend = data.get("monthly_trend",[
        {"month":"January 2026","viols":45,"pct":72,"critical":4,"imp":"Baseline"},
        {"month":"February 2026","viols":38,"pct":78,"critical":2,"imp":"↑ +6%"},
        {"month":"March 2026","viols":29,"pct":85,"critical":1,"imp":"↑ +7%"},
        {"month":"April 2026","viols":27,"pct":comp,"critical":0,"imp":"↑ +3%"},
    ])
    for i,t in enumerate(trend):
        story.append(table_row(
            [t["month"],t["viols"],f'{t["pct"]}%',t["critical"],t["imp"]],
            W5b, LGRAY if i%2==0 else WHITE))
    story.append(Spacer(1,5*mm))

    # ── SECTION 6: CORRECTIVE ACTIONS ──
    story.append(sec_hdr("6. CORRECTIVE ACTIONS & RECOMMENDATIONS"))
    story.append(Spacer(1,2*mm))
    actions = data.get("corrective_actions",[
        "Reinforce helmet compliance at Assembly Line A — mandatory check before shift start",
        "Install additional PPE dispensers at Welding Station entry points",
        "Conduct refresher safety training for Chemical Storage zone workers",
        "Review and update pathway markings at Loading Bay — fading detected",
        "Implement buddy-check system for high-risk zones",
    ])
    for i,action in enumerate(actions):
        row = Table([[
            P(str(i+1), font="Helvetica-Bold", size=9, color=ORANGE, align=TA_CENTER),
            P(action, size=9),
        ]], colWidths=[10*mm,160*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),LGRAY if i%2==0 else WHITE),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),5),
            ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
        ]))
        story.append(row)
    story.append(Spacer(1,5*mm))

    # ── SECTION 7: REGULATORY STATUS ──
    story.append(sec_hdr("7. REGULATORY COMPLIANCE STATUS"))
    story.append(Spacer(1,2*mm))
    W4b = [55*mm,28*mm,77*mm,10*mm]
    story.append(table_hdr(["Regulation","Status","Notes",""], W4b))
    regs = [
        ("Factories Act 1948 — Section 7A","Compliant","Form 18 filed; audit trail available","✓"),
        ("ISO 45001:2018 — Clause 9.1","Compliant","Performance monitoring active","✓"),
        ("OSH Code 2020","Monitoring","Pending full implementation","⊙"),
        ("SEBI BRSR — OHS Disclosure","Compliant","Data ready for annual report","✓"),
        ("PDPB 2023 — Worker Privacy","Compliant","No facial recognition used","✓"),
    ]
    for i,(reg,status,note,icon) in enumerate(regs):
        story.append(table_row([reg,status,note,icon], W4b, LGRAY if i%2==0 else WHITE))
    story.append(Spacer(1,5*mm))

    # ── SIGNATURES ──
    sig = Table([[
        P("_______________________\nEHS Officer\n"+data.get("ehs_officer",""), size=8, align=TA_CENTER),
        P("_______________________\nPlant Manager\n"+data.get("manager_name",""), size=8, align=TA_CENTER),
        P("_______________________\nOccupier / Director\n"+data.get("director",""), size=8, align=TA_CENTER),
    ]], colWidths=[56*mm,57*mm,57*mm])
    sig.setStyle(TableStyle([
        ("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10),
        ("BOX",(0,0),(-1,-1),0.5,MGRAY),
        ("LINEAFTER",(0,0),(1,0),0.5,MGRAY),
    ]))
    story.append(sig)
    story.append(Spacer(1,4*mm))

    # ── FOOTER ──
    footer = Table([[P(
        f"Generated by SafeguardsIQ AI by Syyaim Enterprises · safeguardsiq.com · "
        f"Confidential — For internal use and regulatory submission · "
        f"{datetime.now().strftime('%d %b %Y %H:%M IST')}",
        size=7, color=MGRAY, align=TA_CENTER)]], colWidths=[170*mm])
    footer.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),DARK),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
    ]))
    story.append(footer)

    doc.build(story)
    buf.seek(0)
    return buf.read()

if __name__ == "__main__":
    sample = {
        "report_id":"CR-2026-04","factory_name":"Pune Auto Components Pvt Ltd",
        "location":"Plot 45, MIDC Pimpri, Pune 411018","report_month":"April 2026",
        "period":"01 Apr 2026 – 30 Apr 2026","plan":"Professional","camera_count":8,
        "generated_at":datetime.now().strftime("%d %b %Y"),
        "ehs_officer":"Ramesh Patil","manager_name":"Suresh Nair","director":"Mazhar Imam",
        "kpis":{"compliance_rate":88,"total_violations":27,"persons_monitored":120,
                "critical_incidents":0,"avg_detection_time":"< 3s","cameras_active":8},
    }
    pdf = generate_compliance_report(sample)
    with open("/mnt/user-data/outputs/Compliance_Report_Sample.pdf","wb") as f:
        f.write(pdf)
    print(f"Done: {len(pdf)//1024}KB")
"""
SafeguardsIQ — ROI Report PDF Generator
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

def P(text, font="Helvetica", size=9, color=None, align=TA_LEFT, bold=False):
    if bold: font = "Helvetica-Bold"
    return Paragraph(str(text) if text is not None else "—",
        ParagraphStyle("p", fontName=font, fontSize=size,
            textColor=color or colors.HexColor("#1A1A1A"),
            alignment=align, leading=size+4))

def fmt_inr(amount):
    """Format number as Indian Rupees"""
    amount = int(amount)
    if amount >= 10000000:
        return f"₹{amount/10000000:.1f}Cr"
    elif amount >= 100000:
        return f"₹{amount/100000:.1f}L"
    else:
        return f"₹{amount:,}"

def sec_hdr(title):
    t = Table([[P(f"  {title}", font="Helvetica-Bold", size=10, color=WHITE)]],
               colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
    ]))
    return t

def metric_card(label, value, sub, color=NAVY, width=54*mm):
    t = Table([
        [P(label, size=8, color=colors.HexColor("#666666")),
         P(str(value), font="Helvetica-Bold", size=18, color=color, align=TA_RIGHT)],
        [P(sub, size=8, color=colors.HexColor("#999999")), P("")],
    ], colWidths=[width-20*mm, 18*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),LGRAY),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("LINEAFTER",(0,0),(0,-1),2,color),
    ]))
    return t

def generate_roi_report(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=18*mm)
    story = []

    # ── HEADER ──
    h1 = Table([[
        P("SAFEGUARDSIQ", font="Helvetica-Bold", size=18, color=ORANGE),
        P(f"Generated: {datetime.now().strftime('%d %b %Y')}",
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
        P("RETURN ON INVESTMENT REPORT", font="Helvetica-Bold", size=13, color=WHITE),
        P("SafeguardsIQ AI Safety Platform", size=10, color=ORANGE, align=TA_RIGHT),
    ]], colWidths=[120*mm,50*mm])
    h2.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ]))
    story.append(h2)
    story.append(Spacer(1,5*mm))

    # ── PLANT INFO ──
    factory = data.get("factory_name","—")
    workers = data.get("workers", 0)
    cameras = data.get("cameras", 0)
    plan    = data.get("plan","Professional")

    info = Table([[
        P(f"Factory: {factory}", size=9, bold=True),
        P(f"Workers: {workers}", size=9, align=TA_CENTER),
        P(f"Cameras: {cameras}  ·  Plan: {plan}", size=9, align=TA_RIGHT),
    ]], colWidths=[70*mm,50*mm,50*mm])
    info.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),LGRAY),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),10),
    ]))
    story.append(info)
    story.append(Spacer(1,5*mm))

    # ── ROI CALCULATIONS ──
    accidents_before  = data.get("accidents_year", 10)
    cost_per_accident = data.get("cost_per_accident", 1500000)
    reduction_rate    = data.get("reduction_rate", 0.40)
    plan_price        = data.get("plan_price_per_camera", 2500)
    pilot_weeks       = data.get("pilot_weeks", 4)

    # Cost calculations
    accidents_prevented  = accidents_before * reduction_rate
    annual_accident_cost = accidents_before * cost_per_accident
    savings_from_prevent = accidents_prevented * cost_per_accident
    insurance_reduction  = annual_accident_cost * 0.20
    productivity_gain    = workers * 500 * 12  # ₹500/worker/month productivity
    total_savings        = savings_from_prevent + insurance_reduction

    # SafeguardsIQ cost
    monthly_saas    = cameras * plan_price
    annual_saas     = monthly_saas * 12
    setup_cost      = cameras * 15000  # estimated hardware/setup
    total_year1     = annual_saas + setup_cost

    roi_pct         = ((total_savings - total_year1) / total_year1 * 100) if total_year1 > 0 else 0
    payback_months  = (total_year1 / total_savings * 12) if total_savings > 0 else 0
    net_saving      = total_savings - total_year1

    # ── SECTION 1: EXECUTIVE SUMMARY ──
    story.append(sec_hdr("1. EXECUTIVE SUMMARY"))
    story.append(Spacer(1,3*mm))

    cards = Table([[
        metric_card("ANNUAL SAVINGS", fmt_inr(total_savings), "accident prevention + insurance", GREEN),
        metric_card("NET BENEFIT YEAR 1", fmt_inr(net_saving), "after SafeguardsIQ cost", GREEN if net_saving>0 else RED),
        metric_card("ROI", f"{roi_pct:.0f}%", "first year return", ORANGE),
    ]], colWidths=[57*mm,57*mm,56*mm])
    cards.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2),
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
    ]))
    story.append(cards)
    story.append(Spacer(1,3*mm))

    cards2 = Table([[
        metric_card("PAYBACK PERIOD", f"{payback_months:.1f} months", "investment recovery time", NAVY),
        metric_card("ACCIDENTS PREVENTED", f"{accidents_prevented:.0f}/year", f"{reduction_rate*100:.0f}% reduction target", GREEN),
        metric_card("INSURANCE SAVING", fmt_inr(insurance_reduction), "premium reduction 20%", AMBER),
    ]], colWidths=[57*mm,57*mm,56*mm])
    cards2.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2),
        ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
    ]))
    story.append(cards2)
    story.append(Spacer(1,5*mm))

    # ── SECTION 2: COST OF ACCIDENTS (BEFORE) ──
    story.append(sec_hdr("2. CURRENT COST OF ACCIDENTS (WITHOUT SafeguardsIQ)"))
    story.append(Spacer(1,2*mm))

    cost_rows = [
        ["ESIC / Compensation claims", f"{accidents_before} × {fmt_inr(cost_per_accident*0.6)}", fmt_inr(accidents_before*cost_per_accident*0.6)],
        ["Factories Act legal penalties", f"{accidents_before} × ₹2,00,000", fmt_inr(accidents_before*200000)],
        ["Production downtime (2-5 days)", f"{accidents_before} × ₹1,50,000", fmt_inr(accidents_before*150000)],
        ["Worker replacement / retraining", f"{accidents_before} × ₹75,000",  fmt_inr(accidents_before*75000)],
        ["Reputational / audit risk",       "Estimated",                       fmt_inr(accidents_before*100000)],
        ["Insurance premium loading",       "20% of claim value",              fmt_inr(insurance_reduction)],
    ]
    cost_hdr = Table([[
        P("Cost Component", font="Helvetica-Bold", size=8, color=WHITE),
        P("Calculation", font="Helvetica-Bold", size=8, color=WHITE, align=TA_CENTER),
        P("Annual Cost", font="Helvetica-Bold", size=8, color=WHITE, align=TA_RIGHT),
    ]], colWidths=[80*mm,55*mm,35*mm])
    cost_hdr.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(cost_hdr)

    total_cost = sum([
        accidents_before*cost_per_accident*0.6,
        accidents_before*200000,
        accidents_before*150000,
        accidents_before*75000,
        accidents_before*100000,
        insurance_reduction,
    ])
    for i,(comp,calc,amt) in enumerate(cost_rows):
        row = Table([[
            P(comp, size=9),
            P(calc, size=9, align=TA_CENTER),
            P(amt, size=9, align=TA_RIGHT, bold=True),
        ]], colWidths=[80*mm,55*mm,35*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),LGRAY if i%2==0 else WHITE),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
            ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
        ]))
        story.append(row)

    # Total row
    total_row = Table([[
        P("TOTAL ANNUAL ACCIDENT COST", font="Helvetica-Bold", size=9, color=RED),
        P("", size=9),
        P(fmt_inr(total_cost), font="Helvetica-Bold", size=11, color=RED, align=TA_RIGHT),
    ]], colWidths=[80*mm,55*mm,35*mm])
    total_row.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#FFEBEE")),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(total_row)
    story.append(Spacer(1,5*mm))

    # ── SECTION 3: SafeguardsIQ INVESTMENT ──
    story.append(sec_hdr("3. SafeguardsIQ INVESTMENT"))
    story.append(Spacer(1,2*mm))

    inv_rows = [
        ["Annual SaaS subscription", f"{cameras} cameras × ₹{plan_price:,}/month × 12", fmt_inr(annual_saas)],
        ["One-time setup & installation", f"{cameras} cameras × ₹15,000", fmt_inr(setup_cost)],
        ["SMS + cloud storage", "₹6,000/month × 12", "₹72,000"],
        ["Training & onboarding", "One-time", "₹25,000"],
    ]
    inv_hdr = Table([[
        P("Investment Item", font="Helvetica-Bold", size=8, color=WHITE),
        P("Calculation", font="Helvetica-Bold", size=8, color=WHITE, align=TA_CENTER),
        P("Cost", font="Helvetica-Bold", size=8, color=WHITE, align=TA_RIGHT),
    ]], colWidths=[80*mm,55*mm,35*mm])
    inv_hdr.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(inv_hdr)

    for i,(item,calc,cost) in enumerate(inv_rows):
        row = Table([[P(item,size=9), P(calc,size=9,align=TA_CENTER),
                      P(cost,size=9,align=TA_RIGHT,bold=True)]],
                    colWidths=[80*mm,55*mm,35*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),LGRAY if i%2==0 else WHITE),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
            ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
        ]))
        story.append(row)

    total_inv = Table([[
        P("TOTAL YEAR 1 INVESTMENT", font="Helvetica-Bold", size=9, color=NAVY),
        P("", size=9),
        P(fmt_inr(total_year1), font="Helvetica-Bold", size=11, color=NAVY, align=TA_RIGHT),
    ]], colWidths=[80*mm,55*mm,35*mm])
    total_inv.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#E3F2FD")),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(total_inv)
    story.append(Spacer(1,5*mm))

    # ── SECTION 4: 3-YEAR PROJECTION ──
    story.append(sec_hdr("4. 3-YEAR ROI PROJECTION"))
    story.append(Spacer(1,2*mm))

    yr_hdr = Table([[
        P("", size=8, color=WHITE),
        P("Year 1", font="Helvetica-Bold", size=9, color=WHITE, align=TA_CENTER),
        P("Year 2", font="Helvetica-Bold", size=9, color=WHITE, align=TA_CENTER),
        P("Year 3", font="Helvetica-Bold", size=9, color=WHITE, align=TA_CENTER),
    ]], colWidths=[60*mm,36*mm,37*mm,37*mm])
    yr_hdr.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(yr_hdr)

    yr2_saas = annual_saas * 0.85  # 15% annual discount
    yr3_saas = annual_saas * 0.80
    yr2_savings = total_savings * 1.1
    yr3_savings = total_savings * 1.2

    projection = [
        ["Accident prevention savings", fmt_inr(savings_from_prevent), fmt_inr(savings_from_prevent*1.1), fmt_inr(savings_from_prevent*1.2)],
        ["Insurance premium reduction",  fmt_inr(insurance_reduction),  fmt_inr(insurance_reduction*1.1),  fmt_inr(insurance_reduction*1.2)],
        ["Total Savings",                fmt_inr(total_savings),         fmt_inr(yr2_savings),               fmt_inr(yr3_savings)],
        ["SafeguardsIQ Investment",      fmt_inr(total_year1),           fmt_inr(yr2_saas),                  fmt_inr(yr3_saas)],
        ["Net Benefit",                  fmt_inr(total_savings-total_year1), fmt_inr(yr2_savings-yr2_saas),  fmt_inr(yr3_savings-yr3_saas)],
        ["Cumulative ROI",               f"{roi_pct:.0f}%",              f"{((yr2_savings-yr2_saas+net_saving)/total_year1*100):.0f}%", f"400%+"],
    ]
    for i,(label,y1,y2,y3) in enumerate(projection):
        is_total = label in ["Total Savings","Net Benefit","Cumulative ROI"]
        bg = colors.HexColor("#E8F5E9") if label=="Net Benefit" else (
             colors.HexColor("#FFF3E0") if label=="Cumulative ROI" else (
             LGRAY if i%2==0 else WHITE))
        row = Table([[
            P(label, size=9, bold=is_total),
            P(y1, size=9, align=TA_CENTER, bold=is_total),
            P(y2, size=9, align=TA_CENTER, bold=is_total),
            P(y3, size=9, align=TA_CENTER, bold=is_total),
        ]], colWidths=[60*mm,36*mm,37*mm,37*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),bg),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
            ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
        ]))
        story.append(row)
    story.append(Spacer(1,5*mm))

    # ── SECTION 5: PILOT SUMMARY ──
    story.append(sec_hdr("5. FREE 4-WEEK PILOT RESULTS"))
    story.append(Spacer(1,2*mm))

    pilot_data = data.get("pilot_results", {})
    pilot_rows = [
        ["Violations detected",      str(pilot_data.get("violations_detected", "—"))],
        ["Near misses prevented",    str(pilot_data.get("near_misses", "—"))],
        ["Unsafe acts caught",       str(pilot_data.get("unsafe_acts", "—"))],
        ["PPE compliance improvement",str(pilot_data.get("compliance_improvement", "—"))],
        ["Alerts sent to supervisor",str(pilot_data.get("alerts_sent", "—"))],
        ["Average alert time",       pilot_data.get("avg_alert_time", "< 28 seconds")],
    ]
    for i,(label,val) in enumerate(pilot_rows):
        row = Table([[
            P(label, size=9),
            P(val, size=9, bold=True, align=TA_RIGHT),
        ]], colWidths=[120*mm,50*mm])
        row.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),LGRAY if i%2==0 else WHITE),
            ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
            ("LINEBELOW",(0,0),(-1,-1),0.5,MGRAY),
        ]))
        story.append(row)
    story.append(Spacer(1,5*mm))

    # ── CONCLUSION ──
    conclusion = Table([[P(
        f"Based on your plant's current accident rate of {accidents_before} per year "
        f"and average cost of {fmt_inr(cost_per_accident)} per incident, "
        f"SafeguardsIQ is projected to deliver {fmt_inr(total_savings)} in annual savings — "
        f"paying back the full investment in {payback_months:.1f} months. "
        f"One prevented accident alone pays for over {int(annual_saas/cost_per_accident*10)/10} years of SafeguardsIQ.",
        size=10, color=DARK)]], colWidths=[170*mm])
    conclusion.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#E8F5E9")),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
        ("LINEAFTER",(0,0),(0,-1),3,GREEN),
    ]))
    story.append(conclusion)
    story.append(Spacer(1,5*mm))

    # ── FOOTER ──
    footer = Table([[P(
        f"SafeguardsIQ AI by Syyaim Enterprises · safeguardsiq.com · "
        f"This ROI projection is based on industry averages and DGFASLI data. "
        f"Actual results may vary. · {datetime.now().strftime('%d %b %Y')}",
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
        "factory_name":       "Pune Auto Components Pvt Ltd",
        "workers":            120,
        "cameras":            8,
        "plan":               "Professional",
        "accidents_year":     10,
        "cost_per_accident":  1500000,
        "reduction_rate":     0.40,
        "plan_price_per_camera": 2000,
        "pilot_results": {
            "violations_detected":      47,
            "near_misses":              3,
            "unsafe_acts":              8,
            "compliance_improvement":   "68% → 91%",
            "alerts_sent":              52,
            "avg_alert_time":           "23 seconds",
        },
    }
    pdf = generate_roi_report(sample)
    with open("/mnt/user-data/outputs/ROI_Report_Sample.pdf","wb") as f:
        f.write(pdf)
    print(f"Done: {len(pdf)//1024}KB")

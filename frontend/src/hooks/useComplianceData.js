/**
 * useComplianceData.js
 * SafeguardsIQ — Real data hook for factory-compliance.jsx
 * Place in: frontend/src/hooks/useComplianceData.js
 * 
 * Fetches real violation data from backend and formats it
 * to match the hardcoded data structures in factory-compliance.jsx
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useComplianceData() {
  const [violations,  setViolations]  = useState([]);
  const [ppeTypes,    setPpeTypes]    = useState([]);
  const [zones,       setZones]       = useState([]);
  const [timeline,    setTimeline]    = useState([]);
  const [zoneBars,    setZoneBars]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [stats,       setStats]       = useState({
    openCount: 0, pendingCount: 0, closedToday: 0,
    totalMonth: 0, compliance: 97, cameras: 0,
  });

  const token = localStorage.getItem('safeg_token') || '';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const month = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

        // Fetch violations
        const res = await axios.get(
          `/api/v1/violations/archive?dateFrom=${month}&dateTo=${today}&limit=200`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        const viols = res.data.data?.violations || [];

        // Format violations to match VIOLATIONS structure
        const formattedViols = viols.slice(0, 20).map((v, i) => ({
          id:      v.id?.slice(0,8).toUpperCase() || `VIO-${200-i}`,
          date:    formatDate(v.detected_at),
          type:    v.violation_type || 'PPE Violation',
          zone:    v.camera_id || 'Zone',
          worker:  v.worker_id || '—',
          sev:     capitalize(v.severity || 'medium'),
          action:  v.immediate_action || 'Under review',
          status:  v.status === 'resolved' ? 'Closed'
                 : v.status === 'acknowledged' ? 'Pending' : 'Open',
        }));

        // Count stats
        const todayViols  = viols.filter(v => v.detected_at?.startsWith(today));
        const openCount   = viols.filter(v => v.status === 'open').length;
        const pendingCount = viols.filter(v => v.status === 'acknowledged').length;
        const closedToday = todayViols.filter(v => v.status === 'resolved').length;
        const totalMonth  = viols.length;

        // PPE compliance by type
        const ppeViols = viols.filter(v => v.category === 'ppe' || !v.category);
        const ppeCountByType = {};
        ppeViols.forEach(v => {
          const t = v.violation_type || 'Unknown';
          ppeCountByType[t] = (ppeCountByType[t] || 0) + 1;
        });

        const ppeList = [
          { name:"Hard Hat",      icon:"⛑️", base:100 },
          { name:"Safety Vest",   icon:"🦺", base:100 },
          { name:"Safety Boots",  icon:"👢", base:100 },
          { name:"Eye Protection",icon:"🥽", base:100 },
          { name:"Gloves",        icon:"🧤", base:100 },
          { name:"Face Mask",     icon:"😷", base:100 },
        ].map(p => {
          const violCount = ppeCountByType[p.name] || 0;
          const pct = Math.max(60, Math.min(100, p.base - violCount * 2));
          return {
            name: p.name, icon: p.icon, pct,
            c: pct >= 95 ? '#22D46A' : pct >= 85 ? '#FFB800' : '#FF3B3B',
          };
        });

        // Zone compliance
        const violsByZone = {};
        viols.forEach(v => {
          const z = v.camera_id || 'Unknown';
          violsByZone[z] = (violsByZone[z] || 0) + 1;
        });

        const zoneList = Object.entries(violsByZone)
          .sort((a,b) => b[1]-a[1])
          .slice(0, 6)
          .map(([name, count]) => {
            const pct = Math.max(60, Math.min(100, 100 - count));
            return {
              name, icon:"📹",
              pct,
              c: pct >= 95 ? '#22D46A' : pct >= 85 ? '#FFB800' : '#FF3B3B',
            };
          });

        // Timeline from recent violations
        const timelineList = viols.slice(0, 5).map(v => ({
          icon:  v.severity === 'high' || v.severity === 'critical' ? '🚨' : '⚠️',
          color: v.severity === 'high' ? '#FF3B3B' : '#FFB800',
          title: `${v.violation_type || 'Violation'} — ${v.camera_id || 'Camera'}`,
          meta:  `${formatTime(v.detected_at)} · ${v.camera_id || ''} · ${capitalize(v.status || 'open')}`,
        }));

        // Zone bars
        const zoneBarList = Object.entries(violsByZone)
          .sort((a,b) => b[1]-a[1])
          .slice(0, 7)
          .map(([label, val]) => ({
            label: label.length > 8 ? label.slice(0,8) : label,
            val,
            c: val >= 10 ? '#FF3B3B' : val >= 5 ? '#FF5C1A' : val >= 3 ? '#FFB800' : '#00D4B8',
          }));

        // Use only today's violations for compliance — matches PPEComplianceBar
        const todayViolCount = todayViols.length;
        const frames = Math.max(todayViolCount * 3, 100);
        const compliance = todayViolCount === 0 ? 100
          : Math.max(0, Math.min(99, Math.round(100 - (todayViolCount / frames) * 100)));

        setViolations(formattedViols);
        setPpeTypes(ppeList);
        setZones(zoneList);
        setTimeline(timelineList);
        setZoneBars(zoneBarList);
        setStats({ openCount, pendingCount, closedToday, totalMonth, compliance });

      } catch(e) {
        console.error('Compliance data error:', e);
        // Keep hardcoded data if API fails
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  return { violations, ppeTypes, zones, timeline, zoneBars, stats, loading };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d   = new Date(dateStr);
  const now  = new Date();
  const diff = now - d;
  if (diff < 86400000) return `Today ${d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })}`;
  if (diff < 172800000) return 'Yesterday';
  return `${Math.floor(diff/86400000)} days ago`;
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN',
    { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

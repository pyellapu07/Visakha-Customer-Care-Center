import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Avatar, Tooltip, IconButton, InputBase,
  Badge, Divider,
} from '@mui/material';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { C } from './theme';
import Dashboard from './pages/Dashboard';
import JobBoard from './pages/JobBoard';
import Technicians from './pages/Technicians';
import Parts from './pages/Parts';

const DRAWER_W = 240;

const NAV = [
  { label: 'Dashboard', icon: GridViewRoundedIcon,    path: '/' },
  { label: 'Job Board',  icon: AssignmentRoundedIcon, path: '/jobs' },
  { label: 'Technicians',icon: PeopleAltRoundedIcon,  path: '/technicians' },
  { label: 'Parts',      icon: BuildRoundedIcon,       path: '/parts' },
];

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.25, mx: 1.5, borderRadius: 2,
        cursor: 'pointer', transition: 'all 0.15s ease',
        bgcolor: active ? C.sidebarActive : 'transparent',
        '&:hover': { bgcolor: active ? C.sidebarActive : C.sidebarHover },
      }}
    >
      <Icon sx={{ fontSize: 19, color: active ? '#fff' : 'rgba(255,255,255,0.55)' }} />
      <Typography sx={{
        fontSize: '0.875rem', fontWeight: active ? 600 : 400,
        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
      }}>
        {item.label}
      </Typography>
    </Box>
  );
}

export default function App() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: C.bgPage }}>

      {/* ── Dark Sidebar ── */}
      <Box sx={{
        width: DRAWER_W, flexShrink: 0, bgcolor: C.sidebar,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
      }}>
        {/* Brand */}
        <Box sx={{ px: 2.5, pt: 3, pb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>S</Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                Service OS
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Customer Care
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Search */}
        <Box sx={{ px: 2, mb: 2 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: 'rgba(255,255,255,0.07)', borderRadius: 2,
            px: 1.5, py: 1,
          }}>
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase
              placeholder="Search..."
              sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', flex: 1,
                '::placeholder': { color: 'rgba(255,255,255,0.35)' } }}
            />
            <Box sx={{
              px: 0.75, py: 0.25, bgcolor: 'rgba(255,255,255,0.12)',
              borderRadius: 1, display: 'flex', gap: 0.25,
            }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>⌘K</Typography>
            </Box>
          </Box>
        </Box>

        {/* Nav */}
        <Typography sx={{
          px: 3, mb: 1, fontSize: '0.65rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Main Menu
        </Typography>
        <Box sx={{ flex: 1 }}>
          {NAV.map(item => (
            <NavItem
              key={item.path}
              item={item}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </Box>

        {/* Bottom */}
        <Box sx={{ p: 2 }}>
          <Box sx={{
            bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2,
            p: 1.5, mb: 2,
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', fontWeight: 600, mb: 0.25 }}>
              Visakha Customer Care
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
              Haier ESC · Vizag
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: C.blue, fontSize: '0.8rem', fontWeight: 700 }}>
              AD
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>AdminOwner</Typography>
            </Box>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              <SettingsRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* ── Main ── */}
      <Box sx={{ ml: `${DRAWER_W}px`, flex: 1, minWidth: 0 }}>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/jobs"        element={<JobBoard />} />
          <Route path="/technicians" element={<Technicians />} />
          <Route path="/parts"       element={<Parts />} />
        </Routes>
      </Box>
    </Box>
  );
}

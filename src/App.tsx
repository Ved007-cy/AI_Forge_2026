import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowRight, Bell, Check, CheckCircle2, Clock, Flame, Heart, HandHeart,
  LayoutDashboard, Leaf, Map as MapIcon, MapPin, Menu, PackageCheck, Plus,
  Search, ShieldCheck, SlidersHorizontal, Truck, Utensils, X, AlertTriangle,
  History, Settings, LogOut, Compass, Filter
} from 'lucide-react';
import { seedDonations, initialMetrics, type Donation, type Role, type Status } from './data';

const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n);
const timeLeft = (date: string) => {
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m left` : `${m}m left`;
};
const DEFAULT_ORIGIN = { lat: 13.0067, lng: 80.2572 }; // Adyar, Chennai fallback
const distanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const markerIcon = L.divIcon({ className: 'fs-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] });
type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' };

export default function App() {
  const reduce = useReducedMotion();
  const [role, setRole] = useState<Role>('NGO');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'available' | 'denied' | 'unavailable'>('loading');
  const [page, setPage] = useState('Home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [donations, setDonations] = useState<Donation[]>(() => {
    try { const saved = localStorage.getItem('foodshare-donations'); return saved ? JSON.parse(saved) as Donation[] : seedDonations; }
    catch { return seedDonations; }
  });
  const [toast, setToast] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All food');
  const [urgency, setUrgency] = useState(false);
  const [selected, setSelected] = useState<Donation | null>(null);
  const [claimOpen, setClaimOpen] = useState<Donation | null>(null);
  const [showDonate, setShowDonate] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState('HopeBridge Foundation');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileOrganization, setProfileOrganization] = useState('HopeBridge Foundation');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Prepared meals');
  const [newQty, setNewQty] = useState('20');
  const [newMeals, setNewMeals] = useState('20');
  const [newLocation, setNewLocation] = useState('Adyar, Chennai');
  const [newExpiry, setNewExpiry] = useState('4');
  const [newTags, setNewTags] = useState('Vegetarian');
  const [newNotes, setNewNotes] = useState('');
  const [safety, setSafety] = useState(false);

  useEffect(() => { localStorage.setItem('foodshare-donations', JSON.stringify(donations)); }, [donations]);
  useEffect(() => {
    if (!navigator.geolocation) { setLocationStatus('unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      position => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus('available');
      },
      error => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, []);
  const requestCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('unavailable'); notify('This browser does not support location access.', 'error'); return; }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      position => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setOrigin(next);
        setLocationStatus('available');
        notify('Your current location is now shown on the map.');
      },
      error => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
        notify(error.code === error.PERMISSION_DENIED ? 'Allow location access in your browser settings to show your current location.' : 'Could not get your location. Check GPS and try again.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };
  const getDistance = (donation: Donation) => distanceKm(origin ?? DEFAULT_ORIGIN, { lat: donation.lat, lng: donation.lng });
  const notify = (message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToast(items => [...items, { id, message, kind }]);
    window.setTimeout(() => setToast(items => items.filter(item => item.id !== id)), 3600);
  };
  const available = useMemo(() => donations
    .filter(d => d.status === 'Available' && new Date(d.expiresAt).getTime() > Date.now())
    .filter(d => (category === 'All food' || d.category === category)
      && (!urgency || new Date(d.expiresAt).getTime() - Date.now() < 3 * 3600000)
      && `${d.name} ${d.location} ${d.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()),
  [donations, category, urgency, search]);
  const metrics = useMemo(() => ({
    meals: initialMetrics.meals + donations.filter(d => d.status === 'Collected').reduce((sum, d) => sum + d.meals, 0),
    kg: initialMetrics.kg + donations.filter(d => d.status === 'Collected').reduce((sum, d) => sum + d.quantity * 0.3, 0),
    pickups: initialMetrics.pickups + donations.filter(d => d.status === 'Collected').length,
    partners: initialMetrics.partners,
  }), [donations]);
  const go = (next: string) => { setPage(next); setMobileMenu(false); setSelected(null); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); };
  const updateStatus = (donation: Donation, status: Status) => {
    setDonations(items => items.map(item => item.id !== donation.id ? item : {
      ...item, status,
      claimedBy: status === 'Reserved' || status === 'Pickup scheduled' ? (role === 'NGO' ? 'HopeBridge Foundation' : role === 'Volunteer' ? 'Community volunteer' : item.claimedBy) : item.claimedBy,
      timeline: item.timeline.map((step, index) => ({ ...step, done: index <= ['Available', 'Reserved', 'Pickup scheduled', 'Collected'].indexOf(status) })),
    }));
    notify(status === 'Collected' ? 'Pickup marked complete. Thank you for sharing!' : `Donation ${status.toLowerCase()}.`);
    setClaimOpen(null); setSelected(null);
  };
  const createDonation = () => {
    if (!newName.trim() || !newLocation.trim() || !safety) {
      notify(!safety ? 'Please confirm the food safety checklist.' : 'Add a food name and pickup location.', 'error'); return;
    }
    const donation: Donation = {
      id: `FS-${1050 + donations.length}`, name: newName.trim(), category: newCategory,
      quantity: Number(newQty) || 1, unit: newCategory === 'Produce' ? 'boxes' : newCategory === 'Bakery' ? 'pieces' : 'meal boxes',
      meals: Number(newMeals) || 1, tags: newTags.split(',').map(tag => tag.trim()).filter(Boolean), location: newLocation,
      lat: 13.0067 + (Math.random() - 0.5) * 0.04, lng: 80.2572 + (Math.random() - 0.5) * 0.04,
      expiresAt: new Date(Date.now() + Number(newExpiry) * 3600000).toISOString(), pickupStart: '12:00 PM', pickupEnd: '3:00 PM',
      notes: newNotes, photo: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
      donor: 'Your organisation', status: 'Available', distance: 1.6, createdAt: new Date().toISOString(),
      timeline: [
        { label: 'Donation posted', at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), done: true },
        { label: 'Claim confirmed', at: 'Waiting', done: false },
        { label: 'Pickup scheduled', at: 'Waiting', done: false },
        { label: 'Collected', at: 'Waiting', done: false },
      ],
    };
    setDonations(items => [donation, ...items]); setShowDonate(false); setNewName(''); setSafety(false); setNewNotes('');
    notify('Your donation is live and ready to be claimed.'); go('Donations');
  };
  const isUrgent = (d: Donation) => new Date(d.expiresAt).getTime() - Date.now() < 3 * 3600000;
  const motionProps = reduce ? {} : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.12 }, transition: { duration: 0.45 } };
  const nav = [
    { name: 'Overview', icon: LayoutDashboard }, { name: 'Donations', icon: Utensils },
    { name: 'Live map', icon: MapIcon }, { name: 'Pickup tracking', icon: Truck },
    { name: 'Impact', icon: Heart }, { name: 'Activity', icon: History },
  ];
  const roleOptions: Role[] = ['Donor', 'NGO', 'Volunteer', 'Admin'];

  const Header = () => <header className="topbar">
    <button className="brand" onClick={() => go('Home')} aria-label="FoodShare home"><span className="brand-mark"><Leaf size={21} /></span><span>foodshare<span className="brand-dot">.</span><small>Good food. Shared.</small></span></button>
    <nav className="topnav">{['Discover', 'How it works', 'Our impact'].map((item, index) => <button key={item} onClick={() => go(index === 0 ? 'Donations' : index === 1 ? 'How it works' : 'Impact')}>{item}</button>)}</nav>
    <div className="header-actions"><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={19} /></button><div style={{ position: 'relative' }}>
      <button className="outline-button header-login" aria-expanded={accountMenuOpen} onClick={() => { if (!loggedIn) { setAuthMode('login'); setShowLogin(true); } else setAccountMenuOpen(v => !v); }}>{loggedIn ? 'My account' : 'Log in'}</button>
      {loggedIn && accountMenuOpen && <div role="menu" style={{ position: 'absolute', zIndex: 1200, right: 0, top: 'calc(100% + 10px)', width: 270, background: '#fffdf8', border: '1px solid #e1e6da', borderRadius: 16, padding: 12, boxShadow: '0 18px 45px #173f3524', color: '#173f35' }}>
        <div style={{ padding: '10px 10px 14px', borderBottom: '1px solid #e8ebdf', marginBottom: 7 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 12, background: '#e5eddf', fontWeight: 800 }}>{(profileName || 'U').slice(0,1).toUpperCase()}</span><span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 13 }}>{profileName || 'FoodShare member'}</b><small style={{ color: '#7b8b80' }}>{authEmail || 'Demo account'} · {role}</small></span></div></div>
        <button role="menuitem" onClick={() => { setAccountMenuOpen(false); go('Profile'); }} style={accountMenuItemStyle}><UserRoundIcon /> Basic profile</button>
        <button role="menuitem" onClick={() => { setAccountMenuOpen(false); go('Settings'); }} style={accountMenuItemStyle}><Settings size={16}/> Settings</button>
        <button role="menuitem" onClick={() => { setAccountMenuOpen(false); setLoggedIn(false); setAuthMode('login'); setShowLogin(true); go('Home'); notify('You have been signed out.', 'info'); }} style={{ ...accountMenuItemStyle, color: '#b54b3b', borderTop: '1px solid #e8ebdf', marginTop: 5, paddingTop: 13 }}><LogOut size={16}/> Log out</button>
      </div>}
    </div><button className="primary-button header-cta" onClick={() => { setRole('Donor'); setShowDonate(true); }}>Share food <ArrowRight size={16} /></button><button className="icon-button menu-toggle" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button></div>
    {notificationOpen && <div className="notification-pop"><b>Your community is moving</b><p>3 new donations near Chennai</p><p>A pickup window closes soon</p><button onClick={() => { setNotificationOpen(false); go('Activity'); }}>View activity <ArrowRight size={14} /></button></div>}
  </header>;

  const Sidebar = () => <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
    <div className="workspace-label">YOUR WORKSPACE</div><div className="role-switch"><span className="avatar">{role[0]}</span><span><b>{role === 'NGO' ? 'HopeBridge Foundation' : role === 'Donor' ? 'Green Bowl Kitchen' : role === 'Volunteer' ? 'Community volunteer' : 'Platform admin'}</b><small>{role} workspace</small></span><select aria-label="Switch role" value={role} onChange={e => { setRole(e.target.value as Role); go('Overview'); }}>{roleOptions.map(r => <option key={r}>{r}</option>)}</select></div>
    <div className="side-nav">{nav.map(item => <button key={item.name} className={page === item.name ? 'active' : ''} onClick={() => go(item.name)}><item.icon size={18} />{item.name}{item.name === 'Donations' && <span className="nav-count">{available.length}</span>}</button>)}</div>
    <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><HandHeart size={19} /></div><b>Small acts, big impact.</b><p>Every rescued meal brings us closer to a kinder food system.</p><button onClick={() => go('Impact')}>See your impact <ArrowRight size={14} /></button></div><button className="side-link" onClick={() => go('Settings')}><Settings size={17} /> Settings</button><button className="side-link" onClick={() => { setLoggedIn(false); notify('You have been signed out.', 'info'); go('Home'); }}><LogOut size={17} /> Sign out</button></div>
  </aside>;

  const DonationCard = ({ d }: { d: Donation }) => <motion.article {...motionProps} className="donation-card" whileHover={reduce ? {} : { y: -5, rotateX: 1, rotateY: -1 }} onClick={() => setSelected(d)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSelected(d); }}>
    <div className="donation-image" style={{ backgroundImage: `url("${d.photo}")` }}><span className={`status-pill ${isUrgent(d) ? 'urgent' : 'fresh'}`}>{isUrgent(d) ? <Flame size={13} /> : <Clock size={13} />} {timeLeft(d.expiresAt)}</span></div>
    <div className="donation-content"><div className="card-kicker">{d.category} <span>•</span> {getDistance(d).toFixed(1)} km {origin ? 'away' : 'from Adyar (approx.)'}</div><h3>{d.name}</h3><p className="donation-location"><MapPin size={14} /> {d.location}</p><div className="donation-stats"><div><b>{d.quantity}</b><small>{d.unit}</small></div><div><b>{d.meals}</b><small>estimated meals</small></div></div><div className="tag-row">{d.tags.slice(0, 3).map(tag => <span key={tag} className="food-tag">{tag}</span>)}</div></div>
    <div className="card-bottom"><span>{d.donor}</span><button className="arrow-round" aria-label={`View ${d.name}`} onClick={e => { e.stopPropagation(); setSelected(d); }}>↗</button></div>
  </motion.article>;

  const filters = <div className="filter-bar"><div className="searchbox"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food, location, dietary needs..." aria-label="Search donations" /></div><div className="filter-select"><Filter size={15} /><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category"><option>All food</option><option>Prepared meals</option><option>Bakery</option><option>Produce</option><option>Dairy</option><option>Packaged food</option></select></div><button className={`filter-chip ${urgency ? 'selected' : ''}`} onClick={() => setUrgency(!urgency)}><Flame size={15} /> Urgent only</button><button className="icon-button filter-mobile" onClick={() => setFilterOpen(!filterOpen)}><SlidersHorizontal size={17} /></button>{filterOpen && <label>Category <select value={category} onChange={e => setCategory(e.target.value)}><option>All food</option><option>Prepared meals</option><option>Bakery</option><option>Produce</option></select></label>}</div>;

  const DonationGrid = () => <>{filters}<div className="donation-grid">{available.map(d => <DonationCard key={d.id} d={d} />)}</div>{available.length === 0 && <div className="empty-state"><PackageCheck size={28} /><h3>No matching food just yet</h3><p>Try changing your filters. New donations appear here as neighbours share.</p><button className="outline-button" onClick={() => { setCategory('All food'); setUrgency(false); setSearch(''); }}>Clear filters</button></div>}</>;

  const HomePage = () => <div className="landing"><section className="hero"><div className="hero-copy"><div className="hero-pill">FOOD FOR ALL. WASTE FOR NONE.</div><h1>Good food deserves<br /><em>another table.</em></h1><p>We connect surplus food with the people who need it. Simple acts of sharing, creating a community where nothing good goes to waste.</p><div className="hero-buttons"><button className="primary-button hero-primary" onClick={() => { setRole('NGO'); go('Overview'); }}>Find food near you <ArrowRight size={17} /></button><button className="hero-secondary" onClick={() => { setRole('Donor'); setShowDonate(true); }}><Plus size={16} /> I have food to share</button></div><div className="hero-footnote"><span><ShieldCheck size={15} /> Safe, trusted community</span><span><MapPin size={15} /> Hyperlocal food sharing</span></div></div><div className="hero-visual"><div className="hero-blob" /><motion.div className="food-photo photo-main" animate={reduce ? {} : { y: [0, -10, 0], rotate: [-2, 0, -2] }} transition={{ duration: 7, repeat: Infinity }}><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85" alt="Fresh nourishing meal ready to share" /><span className="photo-caption"><Leaf size={15} /> Made with care<br /><small>Ready to be shared</small></span></motion.div><motion.div className="floating-card meals-float" animate={reduce ? {} : { y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity }}><Utensils size={17} /><b>128 meals</b><small>rescued this morning</small></motion.div><motion.div className="floating-card pin-float" animate={reduce ? {} : { y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity }}><MapPin size={18} /><b>Just around you</b><small>3 nearby donations</small></motion.div></div></section><section className="landing-stats"><div><span>OUR COMMUNITY HAS RESCUED</span><b>{fmt(metrics.meals)} meals</b></div><div><b>{Math.round(metrics.kg)} kg</b><span>FOOD KEPT OUT OF WASTE</span></div><div><b>{metrics.partners}+</b><span>LOCAL NGO PARTNERS</span></div><button onClick={() => go('Impact')}>See our impact <ArrowRight size={16} /></button></section><section className="how-section"><div className="section-heading"><div><div className="eyebrow">A SIMPLE WAY TO DO SOMETHING GOOD</div><h2>Sharing should feel <em>simple.</em></h2><p>From extra food to a full table, in three thoughtful steps.</p></div></div><div className="steps-grid"><div className="step-card"><span className="step-number">01</span><Utensils size={30} /><h3>Share what’s extra</h3><p>Restaurants, homes and events list safe, surplus food in a couple of minutes.</p></div><div className="step-card"><span className="step-number">02</span><MapPin size={30} /><h3>Connect nearby</h3><p>NGOs and volunteers find food before it expires, right in their neighbourhood.</p></div><div className="step-card"><span className="step-number">03</span><HandHeart size={30} /><h3>Pass the good on</h3><p>Coordinate a safe pickup and get food to people who can use it today.</p></div></div></section></div>;

  const Dashboard = () => <><div className="welcome-row"><div><div className="eyebrow">COMMUNITY IMPACT, IN REAL TIME</div><h1>Good morning, <em>{profileName?.trim() || (role === 'NGO' ? 'HopeBridge Foundation' : role === 'Donor' ? 'Green Bowl' : role === 'Volunteer' ? 'Neighbour' : 'Admin')}.</em></h1><p className="subhead">There’s good food out there. Let’s get it where it belongs.</p></div><button className="primary-button" onClick={() => role === 'Donor' ? setShowDonate(true) : go('Live map')}>{role === 'Donor' ? <Plus size={17} /> : <Compass size={17} />} {role === 'Donor' ? 'Create donation' : 'Explore nearby'}</button></div><div className="impact-strip"><div className="impact-intro"><SparklesIcon /><b>Look what we’ve done together</b></div><div className="impact-number"><b>{fmt(metrics.meals)}</b><small>meals rescued</small></div><div className="impact-number"><b>{Math.round(metrics.kg)}</b><small>kg food saved</small></div><div className="impact-number"><b>{metrics.pickups}</b><small>successful pickups</small></div><div className="impact-number"><b>{metrics.partners}</b><small>NGO partners</small></div></div><div className="section-heading"><div><div className="eyebrow">NEAR YOUR COMMUNITY</div><h2>Food that needs a home <span className="live-indicator">LIVE</span></h2><p>Freshly shared by people and businesses around you.</p></div><button className="text-button" onClick={() => go('Donations')}>Explore all donations <ArrowRight size={16} /></button></div><DonationGrid /><div className="community-banner"><div className="banner-copy"><span className="eyebrow">GOOD FOOD SHOULD NEVER GO TO WASTE</span><h2>One extra meal can change someone’s day.</h2><p>Have more than you need? Your next small act can make a big difference.</p><button className="primary-button" onClick={() => { setRole('Donor'); setShowDonate(true); }}>Share a donation <ArrowRight size={16} /></button></div><div className="banner-number"><b>1 in 3</b><span>food produced is wasted globally</span></div></div></>;

  const MapPage = () => <><div className="page-title"><div><div className="eyebrow">LOCAL FOOD, LOCAL CARE</div><h1>Good things are <em>closer than you think.</em></h1><p>Explore available donations around Chennai.</p></div></div><div className="map-layout"><div className="map-canvas" style={{ position: 'relative' }}>
  <div style={{ position: 'absolute', zIndex: 500, top: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center', background: '#fffdf8', border: '1px solid #dfe5d8', borderRadius: 12, padding: '8px 10px', boxShadow: '0 3px 12px #173f3512', fontSize: 12 }}>
    <span style={{ width: 9, height: 9, borderRadius: 99, background: origin ? '#2878e8' : '#9aa49b', display: 'inline-block' }} />
    <span>{locationStatus === 'available' ? 'Current location active' : locationStatus === 'loading' ? 'Finding your location…' : locationStatus === 'denied' ? 'Location permission blocked' : 'Location unavailable'}</span>
    {!origin && <button onClick={requestCurrentLocation} style={{ border: 0, borderRadius: 8, background: '#173f35', color: 'white', padding: '6px 9px', cursor: 'pointer' }}>Use my location</button>}
  </div>
  <MapContainer center={origin ? [origin.lat, origin.lng] : [13.0067, 80.2472]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', minHeight: 450, width: '100%' }}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
    {origin && <Marker position={[origin.lat, origin.lng]} icon={L.divIcon({ className: 'fs-user-location', html: '<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:#2878e8;box-shadow:0 0 0 7px #2878e844,0 2px 8px #173f3566"></span>', iconSize: [32, 32], iconAnchor: [16, 16] })}><Popup><b>Your current location</b><br />Distances are calculated from here.</Popup></Marker>}
    {available.map(d => <Marker key={d.id} position={[d.lat, d.lng]} icon={markerIcon} eventHandlers={{ click: () => setSelected(d) }}><Popup><b>{d.name}</b><br />{origin ? `${getDistance(d).toFixed(1)} km from you` : `${getDistance(d).toFixed(1)} km from Adyar, Chennai (approx.)`}<br />{d.meals} meals · {timeLeft(d.expiresAt)}<br /><button onClick={() => setSelected(d)}>View donation</button></Popup></Marker>)}
  </MapContainer>
</div><div className="map-results"><b>Nearby donations · {available.length} available</b>{available.map(d => <button className="map-result" key={d.id} onClick={() => setSelected(d)}><img src={d.photo} alt="" /><span><b>{d.name}</b><small><MapPin size={12} /> {getDistance(d).toFixed(1)} km {origin ? 'away' : 'from Adyar (approx.)'} · {d.meals} meals</small><small><Clock size={12} /> {timeLeft(d.expiresAt)}</small></span></button>)}</div></div></>;

  const TrackingPage = () => { const tracked = donations.filter(d => d.status !== 'Available'); return <><div className="page-title"><div><div className="eyebrow">EVERY STEP COUNTS</div><h1>From here to <em>there.</em></h1><p>Keep the handoff smooth, safe, and full of care.</p></div></div>{tracked.length === 0 ? <div className="empty-state"><Truck size={26} /><h3>Your pickup journey starts here</h3><p>When a donation is claimed, its pickup progress appears here.</p><button className="primary-button" onClick={() => go('Donations')}>Find a donation <ArrowRight size={15} /></button></div> : <div className="tracking-list">{tracked.map(d => <div className="tracking-card" key={d.id}><div className="tracking-card-head"><div><span className="small-id">{d.id}</span><h3>{d.name}</h3><p><MapPin size={14} /> {d.location}</p></div><span className="status-label">{d.status}</span></div><div className="timeline">{d.timeline.map((step, index) => <div key={step.label} className={`timeline-step ${step.done ? 'done' : ''}`}><span className="timeline-dot">{step.done ? <Check size={13} /> : index + 1}</span><div><b>{step.label}</b><small>{step.done ? step.at : 'Awaiting update'}</small></div></div>)}</div><div className="tracking-actions">{d.status === 'Reserved' && <button className="primary-button" onClick={() => updateStatus(d, 'Pickup scheduled')}>Schedule pickup</button>}{d.status === 'Pickup scheduled' && <button className="primary-button" onClick={() => updateStatus(d, 'Collected')}>Mark as collected <CheckCircle2 size={15} /></button>}<button className="outline-button" onClick={() => setSelected(d)}>View details</button></div></div>)}</div>}</>; };

  const ImpactPage = () => <><div className="impact-hero"><div className="eyebrow">A LITTLE LESS WASTE. A LOT MORE CARE.</div><h1>Good food is too good to <em>go to waste.</em></h1><p>Every number is a meal shared, a neighbour supported, and a little more hope passed along.</p><div className="impact-hero-number"><span>TOGETHER, WE’VE RESCUED</span><b>{fmt(metrics.meals)}</b><span>meals and counting</span></div></div><div className="impact-metric-grid"><div><PackageCheck /><b>{fmt(metrics.meals)}</b><h3>Meals rescued</h3><p>Good food, back on the table.</p></div><div><Leaf /><b>{Math.round(metrics.kg)} kg</b><h3>Food waste diverted</h3><p>Less waste, more value in every bite.</p></div><div><Truck /><b>{metrics.pickups}</b><h3>Successful pickups</h3><p>Every handoff makes a difference.</p></div><div><Heart /><b>{metrics.partners}</b><h3>Community partners</h3><p>Local organisations, one shared mission.</p></div></div></>;

  const ActivityPage = () => <><div className="page-title"><div><div className="eyebrow">YOUR COMMUNITY, IN MOTION</div><h1>Good things <em>happening.</em></h1><p>A transparent trail from surplus food to shared meals.</p></div></div><div className="activity-feed">{[...donations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(d => <div className="activity-item" key={d.id}><div className="activity-icon"><PackageCheck size={18} /></div><div><b>{d.name}</b><p>{d.status === 'Available' ? 'Donation shared and available for claiming' : `Donation ${d.status.toLowerCase()}`}</p><small>{d.location} · {d.id}</small></div><span className="activity-status">{d.status}</span></div>)}</div></>;

  const DetailModal = () => selected ? <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><motion.div initial={reduce ? {} : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="detail-modal"><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details"><X /></button><img className="detail-photo" src={selected.photo} alt={selected.name} /><div className="detail-body"><div className="detail-kicker"><span className={`status-pill ${isUrgent(selected) ? 'urgent' : 'fresh'}`}><Clock size={13} /> {timeLeft(selected.expiresAt)}</span><span>{selected.id}</span></div><h2>{selected.name}</h2><p className="detail-description">{selected.notes || 'Freshly prepared and ready to be shared with the community.'}</p><div className="detail-info-grid"><div><small>QUANTITY</small><b>{selected.quantity} {selected.unit}</b></div><div><small>ESTIMATED MEALS</small><b>{selected.meals} meals</b></div><div><small>PICKUP WINDOW</small><b>{selected.pickupStart} – {selected.pickupEnd}</b></div><div><small>DISTANCE</small><b>{getDistance(selected).toFixed(1)} km {origin ? 'away' : 'from Adyar (approx.)'}</b></div></div><div className="detail-location"><MapPin size={17} /><div><b>Pickup location</b><p>{selected.location}</p></div></div><div className="tag-row">{selected.tags.map(tag => <span className="food-tag" key={tag}>{tag}</span>)}</div><div className="privacy-note"><ShieldCheck size={17} /><span><b>Community privacy protected</b><small>Contact details are shared only after a donation is accepted.</small></span></div>{selected.status === 'Available' ? <button className="primary-button full-button" onClick={() => { if (new Date(selected.expiresAt).getTime() <= Date.now()) { notify('This donation has expired and can no longer be claimed.', 'error'); return; } if (role === 'Donor') { notify('Switch to an NGO workspace to claim donations.', 'info'); return; } setClaimOpen(selected); }}>Claim this donation <ArrowRight size={17} /></button> : <div className="claimed-note"><CheckCircle2 size={17} /> This donation is {selected.status.toLowerCase()}. {selected.claimedBy && <span>Claimed by {selected.claimedBy}.</span>}</div>}</div></motion.div></div> : null;

  const ClaimModal = () => claimOpen ? <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setClaimOpen(null); }}><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="confirm-modal"><button className="modal-close" onClick={() => setClaimOpen(null)}><X /></button><div className="confirm-icon"><HandHeart size={27} /></div><div className="eyebrow">A GOOD THING STARTS HERE</div><h2>Ready to give this food a home?</h2><p>You’re claiming <b>{claimOpen.name}</b>, estimated to feed {claimOpen.meals} people. Please make sure you can collect it within the pickup window.</p><div className="confirm-summary"><span><MapPin size={15} /> {claimOpen.location}</span><span><Clock size={15} /> {claimOpen.pickupStart} – {claimOpen.pickupEnd}</span><span><Flame size={15} /> {timeLeft(claimOpen.expiresAt)}</span></div><button className="primary-button full-button" onClick={() => { if (new Date(claimOpen.expiresAt).getTime() <= Date.now()) { notify('This donation has expired and can no longer be claimed.', 'error'); setClaimOpen(null); return; } updateStatus(claimOpen, 'Reserved'); go('Pickup tracking'); }}>Confirm claim <Check size={17} /></button><button className="text-button cancel-button" onClick={() => setClaimOpen(null)}>Not right now</button></motion.div></div> : null;

  const donateModal = showDonate ? <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowDonate(false); }}><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="donate-modal"><button className="modal-close" onClick={() => setShowDonate(false)}><X /></button><div className="eyebrow">SHARE SOMETHING GOOD</div><h2>Give your extra food <em>a second life.</em></h2><p className="modal-intro">A few details help the right people find your donation quickly.</p><form onSubmit={e => { e.preventDefault(); createDonation(); }}><label>Food name<input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Vegetable pulao boxes" /></label><div className="form-two"><label>Category<select value={newCategory} onChange={e => setNewCategory(e.target.value)}><option>Prepared meals</option><option>Bakery</option><option>Produce</option><option>Dairy</option><option>Packaged food</option></select></label><label>Quantity<input required type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} /></label></div><div className="form-two"><label>Estimated meals<input required type="number" min="1" value={newMeals} onChange={e => setNewMeals(e.target.value)} /></label><label>Expires in<select value={newExpiry} onChange={e => setNewExpiry(e.target.value)}><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></label></div><label>Pickup location<input required value={newLocation} onChange={e => setNewLocation(e.target.value)} /></label><label>Dietary tags <small>(comma separated)</small><input value={newTags} onChange={e => setNewTags(e.target.value)} /></label><label>Pickup notes<textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} /></label><label className="safety-check"><input type="checkbox" checked={safety} onChange={e => setSafety(e.target.checked)} /><span><b>Food safety confirmation</b><small>I confirm this food has been safely stored, is suitable for donation, and allergen information is accurate.</small></span></label><button className="primary-button full-button" type="submit">Publish donation <ArrowRight size={17} /></button></form></motion.div></div> : null;

  const accountMenuItemStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '11px 10px', border: 0, borderRadius: 9, background: 'transparent', color: '#173f35', cursor: 'pointer', fontSize: 13, fontWeight: 650 };
  const authInputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #dce4d8', borderRadius: 11, background: '#fffdf8', color: '#173f35', minHeight: 47, padding: '12px 14px', outlineColor: '#477a60', font: 'inherit' };
  const loginModal = showLogin ? <div className="foodshare-auth-page" style={{ position: 'fixed', inset: 0, zIndex: 1000, overflowY: 'auto', background: '#f7f5ec', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 0.9fr)', color: '#173f35' }}>
    <section style={{ padding: 'clamp(28px, 6vw, 84px)', background: '#173f35', color: '#fffdf6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' }}>
      <button onClick={() => setShowLogin(false)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'inherit', fontWeight: 800, cursor: 'pointer', fontSize: 18 }}>← FoodShare</button>
      <div style={{ maxWidth: 560, margin: 'auto 0' }}>
        <div style={{ color: '#f4c95d', textTransform: 'uppercase', letterSpacing: '.18em', fontSize: 11, fontWeight: 800, marginBottom: 22 }}>Good food deserves another table</div>
        <h1 style={{ fontSize: 'clamp(42px, 6vw, 76px)', lineHeight: 1.02, letterSpacing: '-.055em', margin: '0 0 24px' }}>Share more.<br /><em style={{ color: '#ff8d73', fontFamily: 'Georgia, serif', fontWeight: 400 }}>Waste less.</em></h1>
        <p style={{ maxWidth: 430, lineHeight: 1.8, color: '#d3e1d7', fontSize: 16 }}>Join neighbours, restaurants and community groups turning surplus food into meals and meaningful connections.</p>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 36 }}>
          <div><strong style={{ display: 'block', fontSize: 25 }}>2,480+</strong><span style={{ color: '#d3e1d7', fontSize: 12 }}>Meals rescued</span></div>
          <div><strong style={{ display: 'block', fontSize: 25 }}>38</strong><span style={{ color: '#d3e1d7', fontSize: 12 }}>Community partners</span></div>
          <div><strong style={{ display: 'block', fontSize: 25 }}>1,260 kg</strong><span style={{ color: '#d3e1d7', fontSize: 12 }}>Food diverted</span></div>
        </div>
      </div>
      <small style={{ color: '#b9cec1' }}>A little extra can mean a lot to someone.</small>
    </section>
    <section style={{ padding: 'clamp(24px, 5vw, 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <button aria-label="Close authentication" onClick={() => setShowLogin(false)} style={{ position: 'absolute', right: 24, top: 24, border: '1px solid #dfe5d8', background: '#fffdf8', borderRadius: 99, width: 42, height: 42, cursor: 'pointer', fontSize: 22, color: '#173f35' }}>×</button>
      <motion.div key={authMode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 15, background: '#173f35', color: '#f4c95d', marginBottom: 28 }}><Leaf size={25} /></div>
        <div style={{ color: '#688574', fontSize: 10, fontWeight: 800, letterSpacing: '.17em', marginBottom: 12 }}>WELCOME TO FOODSHARE</div>
        <h2 style={{ fontSize: 36, letterSpacing: '-.045em', lineHeight: 1.1, margin: '0 0 12px' }}>{authMode === 'login' ? 'Good to have you here.' : 'Let’s make a difference.'}</h2>
        <p style={{ color: '#718177', lineHeight: 1.7, marginBottom: 25 }}>{authMode === 'login' ? 'Sign in to continue to your community workspace.' : 'Create your account and help good food find a second life.'}</p>
        <div role="tablist" aria-label="Account access" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 5, borderRadius: 13, background: '#e9eee5', marginBottom: 24 }}>
          <button type="button" role="tab" aria-selected={authMode === 'login'} onClick={() => setAuthMode('login')} style={{ border: 0, borderRadius: 9, padding: '12px 8px', cursor: 'pointer', fontWeight: 750, background: authMode === 'login' ? '#fffdf8' : 'transparent', color: '#173f35' }}>Log in</button>
          <button type="button" role="tab" aria-selected={authMode === 'register'} onClick={() => setAuthMode('register')} style={{ border: 0, borderRadius: 9, padding: '12px 8px', cursor: 'pointer', fontWeight: 750, background: authMode === 'register' ? '#fffdf8' : 'transparent', color: '#173f35' }}>Create account</button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (authMode === 'register' && !authName.trim()) { notify('Please enter your full name.', 'error'); return; }
          if (authMode === 'register' && authPassword !== authConfirmPassword) { notify('Passwords do not match.', 'error'); return; }
          if (authPassword.length < 8) { notify('Use a password with at least 8 characters.', 'error'); return; }
          if (!authEmail.trim()) { notify('Please enter your email address.', 'error'); return; }
          setLoggedIn(true); if (authName.trim()) setProfileName(authName.trim()); else if (authEmail.trim()) setProfileName(authEmail.split('@')[0]); setShowLogin(false); setAccountMenuOpen(false); go('Overview');
          notify(authMode === 'register' ? `Demo account created for ${role.toLowerCase()}. Connect Supabase to save accounts securely.` : `Welcome back to your ${role.toLowerCase()} workspace. Demo mode is active.`);
        }} style={{ display: 'grid', gap: 15 }}>
          {authMode === 'register' && <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Full name<input required autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name" style={authInputStyle} /></label>}
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Your role<select value={role} onChange={e => setRole(e.target.value as Role)} style={authInputStyle}>{roleOptions.map(r => <option key={r}>{r}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Email address<input required type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@yourorganisation.org" style={authInputStyle} /></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Password<input required type="password" minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 8 characters" style={authInputStyle} /></label>
          {authMode === 'register' && <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} placeholder="Enter your password again" style={authInputStyle} /></label>}
          <button type="submit" className="primary-button full-button" style={{ border: 0, minHeight: 50, marginTop: 5 }}>{authMode === 'login' ? 'Log in to workspace' : 'Create my account'} <ArrowRight size={16} /></button>
        </form>
        <p style={{ textAlign: 'center', color: '#89978c', fontSize: 11, lineHeight: 1.7, marginTop: 20 }}>Demo mode · Authentication is not connected to Supabase yet.</p>
      </motion.div>
    </section>
    <style>{`@media(max-width:760px){.foodshare-auth-page{grid-template-columns:1fr!important}.foodshare-auth-page>section:first-child{display:none!important}.foodshare-auth-page>section:last-child{min-height:100dvh;padding:28px!important}}`}</style>
  </div> : null;
  return <div className="app-shell">
    <Header />
    {page === 'Home' ? <HomePage /> : <div className="workspace"><Sidebar /><main className="main-content"><div className="mobile-page-head"><button onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button><span>{page}</span><button onClick={() => setNotificationOpen(!notificationOpen)}><Bell /></button></div><AnimatePresence mode="wait"><motion.div key={page} initial={reduce ? {} : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? {} : { opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>
      {page === 'Overview' ? <Dashboard /> : page === 'Donations' ? <><div className="page-title"><div><div className="eyebrow">THE COMMUNITY PANTRY</div><h1>Find good food. <em>Pass it forward.</em></h1><p>Every listing is a chance to make a meal matter.</p></div><button className="primary-button" onClick={() => { setRole('Donor'); setShowDonate(true); }}><Plus size={17} /> Share food</button></div><DonationGrid /></> : page === 'Live map' ? <MapPage /> : page === 'Pickup tracking' ? <TrackingPage /> : page === 'Impact' ? <ImpactPage /> : page === 'Activity' ? <ActivityPage /> : page === 'Profile' ? <div className="info-page" style={{ maxWidth: 900 }}>
        <div className="eyebrow">YOUR ACCOUNT</div><h1>Basic <em>profile.</em></h1><p>Manage the details people in your FoodShare community see about you.</p>
        <form onSubmit={e => { e.preventDefault(); notify('Profile details saved in this demo.', 'success'); }} style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18, background: '#fffdf8', border: '1px solid #e5e7dc', borderRadius: 20, padding: 24 }}>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Full name<input value={profileName} onChange={e => setProfileName(e.target.value)} required style={authInputStyle}/></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Email address<input value={authEmail} type="email" readOnly style={{ ...authInputStyle, background: '#f0f1e9', color: '#6f7c72' }}/></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Role<input value={role} readOnly style={{ ...authInputStyle, background: '#f0f1e9' }}/></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Organisation / community<input value={profileOrganization} onChange={e => setProfileOrganization(e.target.value)} placeholder="Organisation name" style={authInputStyle}/></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 750 }}>Phone number<input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+91 ..." type="tel" style={authInputStyle}/></label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="submit" className="primary-button">Save profile <Check size={16}/></button><button type="button" className="outline-button" onClick={() => { setLoggedIn(false); setAuthMode('login'); setShowLogin(true); go('Home'); notify('You have been signed out.', 'info'); }}>Log out <LogOut size={16}/></button></div>
        </form>
      </div> : <div className="info-page"><div className="eyebrow">YOUR FOODSHARE SPACE</div><h1>{page === 'Settings' ? 'Your preferences, your way.' : 'How FoodShare works.'}</h1><p>Choose a workspace to explore donor, NGO, volunteer and admin experiences. Demo data is saved in this browser.</p><div className="role-grid">{roleOptions.map(r => <button className={`role-card ${role === r ? 'role-current' : ''}`} key={r} onClick={() => { setRole(r); notify(`${r} workspace selected`, 'info'); }}><span>{r === 'Donor' ? <Utensils /> : r === 'NGO' ? <HandHeart /> : r === 'Volunteer' ? <Truck /> : <ShieldCheck />}</span><b>{r}</b><small>{r === 'Donor' ? 'Create and manage food donations' : r === 'NGO' ? 'Discover, claim and collect food' : r === 'Volunteer' ? 'Help move food where it’s needed' : 'Verify users and monitor impact'}</small></button>)}</div><button className="primary-button" onClick={() => go('Overview')}>Open workspace <ArrowRight size={16} /></button></div>}
    </motion.div></AnimatePresence></main></div>}
    {page === 'Home' && <div className="floating-role"><button onClick={() => go('Overview')}><LayoutDashboard size={17} /> Open demo workspace</button></div>}
    <div className="toast-stack" aria-live="polite"><AnimatePresence>{toast.map(item => <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`toast toast-${item.kind}`} key={item.id}><span>{item.kind === 'success' ? <CheckCircle2 size={18} /> : item.kind === 'error' ? <AlertTriangle size={18} /> : <Bell size={18} />}</span>{item.message}<button onClick={() => setToast(items => items.filter(x => x.id !== item.id))} aria-label="Dismiss notification"><X size={15} /></button></motion.div>)}</AnimatePresence></div>
    <DetailModal /><ClaimModal />{donateModal}{loginModal}
    <button className="mobile-quick-donate" onClick={() => { setRole('Donor'); setShowDonate(true); }}><Plus size={19} /><span>Quick donate</span></button>
  </div>;
}

function UserRoundIcon() { return <span style={{ width: 16, display: 'inline-grid', placeItems: 'center' }}>◉</span>; }
function SparklesIcon() { return <span className="impact-icon">✦</span>; }

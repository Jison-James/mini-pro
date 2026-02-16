-- Enterprise Indoor Navigation Database Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','institution','admin','event_organizer')),
  avatar_url TEXT,
  institution_id TEXT,
  department TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  logo_url TEXT,
  main_map_url TEXT,
  cover_url TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  owner_id TEXT NOT NULL,
  is_published INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  name TEXT NOT NULL,
  building_code TEXT,
  building_type TEXT DEFAULT 'academic',
  latitude REAL,
  longitude REAL,
  description TEXT,
  floor_count INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  floor_number INTEGER NOT NULL,
  name TEXT,
  image_url TEXT,
  width REAL DEFAULT 1000,
  height REAL DEFAULT 800,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'normal' CHECK(node_type IN ('normal','hidden','connector','stairs','elevator','ramp','emergency_exit','restricted','outdoor')),
  is_selectable INTEGER DEFAULT 1,
  description TEXT,
  connects_to_floor_id TEXT,
  connects_to_node_id TEXT,
  connects_to_building_id TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
  FOREIGN KEY (connects_to_floor_id) REFERENCES floors(id),
  FOREIGN KEY (connects_to_node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  is_stairs INTEGER DEFAULT 0,
  is_elevator INTEGER DEFAULT 0,
  is_wheelchair_accessible INTEGER DEFAULT 1,
  is_restricted INTEGER DEFAULT 0,
  is_outdoor INTEGER DEFAULT 0,
  crowd_level INTEGER DEFAULT 0,
  edge_type TEXT DEFAULT 'hallway',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
  FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS map_access (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'public' CHECK(access_type IN ('public','private','key','email_pattern','role','time_based')),
  access_key TEXT,
  email_pattern TEXT,
  allowed_roles TEXT,
  valid_from DATETIME,
  valid_until DATETIME,
  department TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reply TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS map_comments (
  id TEXT PRIMARY KEY,
  node_id TEXT,
  floor_id TEXT,
  user_id TEXT NOT NULL,
  comment_type TEXT DEFAULT 'comment' CHECK(comment_type IN ('comment','warning','info')),
  content TEXT NOT NULL,
  x REAL,
  y REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  FOREIGN KEY (floor_id) REFERENCES floors(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  institution_id TEXT,
  building_id TEXT,
  floor_id TEXT,
  node_id TEXT,
  organizer_id TEXT NOT NULL,
  event_date DATETIME,
  end_date DATETIME,
  image_url TEXT,
  is_published INTEGER DEFAULT 0,
  latitude REAL,
  longitude REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id),
  FOREIGN KEY (building_id) REFERENCES buildings(id),
  FOREIGN KEY (floor_id) REFERENCES floors(id),
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS event_maps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  floor_id TEXT NOT NULL,
  highlighted_area TEXT,
  custom_nodes TEXT,
  custom_edges TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (floor_id) REFERENCES floors(id)
);

CREATE TABLE IF NOT EXISTS user_map_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  from_node_id TEXT,
  to_node_id TEXT,
  route_mode TEXT DEFAULT 'shortest',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS saved_maps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS navigation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  institution_id TEXT NOT NULL,
  from_node_name TEXT,
  to_node_name TEXT,
  route_mode TEXT DEFAULT 'shortest',
  path_nodes TEXT,
  duration_ms INTEGER,
  searched_term TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS blogs (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_floor ON nodes(floor_id);
CREATE INDEX IF NOT EXISTS idx_edges_floor ON edges(floor_id);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_buildings_inst ON buildings(institution_id);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);
CREATE INDEX IF NOT EXISTS idx_nav_logs_inst ON navigation_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_nav_logs_time ON navigation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_map_access_inst ON map_access(institution_id);
CREATE INDEX IF NOT EXISTS idx_access_req_inst ON access_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_events_inst ON events(institution_id);

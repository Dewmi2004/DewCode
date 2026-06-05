import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type UserRole = 'Admin' | 'Developer' | 'Viewer';
export type ThemeName = 'dark' | 'light' | 'solarized' | 'monokai' | 'dracula' | 'nord' | 'high-contrast';

export interface UserSettings {
  appearance: {
    theme: ThemeName;
    accentColor: string;
    compactMode: boolean;
    reduceMotion: boolean;
  };
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
    lineNumbers: boolean;
    autoSave: boolean;
    formatOnSave: boolean;
  };
  layout: {
    sidebarCollapsed: boolean;
    settingsNavCollapsed: boolean;
    editorExplorerCollapsed: boolean;
    terminalCollapsed: boolean;
  };
  github: {
    username: string;
    defaultBranch: string;
    autoSync: boolean;
    tokenConfigured: boolean;
    tokenLast4: string;
  };
  security: {
    twoFactorEnabled: boolean;
    loginAlerts: boolean;
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: {
    theme: 'dark',
    accentColor: '#00D4B8',
    compactMode: false,
    reduceMotion: false,
  },
  editor: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: true,
    autoSave: false,
    formatOnSave: false,
  },
  layout: {
    sidebarCollapsed: false,
    settingsNavCollapsed: false,
    editorExplorerCollapsed: false,
    terminalCollapsed: false,
  },
  github: {
    username: '',
    defaultBranch: 'main',
    autoSync: false,
    tokenConfigured: false,
    tokenLast4: '',
  },
  security: {
    twoFactorEnabled: false,
    loginAlerts: true,
  },
};

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  isEmailVerified: boolean;
  refreshTokens: string[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  isLocked(): boolean;
  toSafeObject(): SafeUser;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isEmailVerified: boolean;
  settings: UserSettings;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      // ── unique: true removed here — defined once via schema.index() below
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['Admin', 'Developer', 'Viewer'],
      default: 'Developer',
    },
    avatar: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    settings: {
      appearance: {
        theme: {
          type: String,
          enum: ['dark', 'light', 'solarized', 'monokai', 'dracula', 'nord', 'high-contrast'],
          default: DEFAULT_USER_SETTINGS.appearance.theme,
        },
        accentColor: {
          type: String,
          default: DEFAULT_USER_SETTINGS.appearance.accentColor,
        },
        compactMode: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.appearance.compactMode,
        },
        reduceMotion: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.appearance.reduceMotion,
        },
      },
      editor: {
        fontSize: {
          type: Number,
          min: 10,
          max: 24,
          default: DEFAULT_USER_SETTINGS.editor.fontSize,
        },
        fontFamily: {
          type: String,
          default: DEFAULT_USER_SETTINGS.editor.fontFamily,
        },
        tabSize: {
          type: Number,
          min: 2,
          max: 8,
          default: DEFAULT_USER_SETTINGS.editor.tabSize,
        },
        wordWrap: {
          type: String,
          enum: ['on', 'off'],
          default: DEFAULT_USER_SETTINGS.editor.wordWrap,
        },
        minimap: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.editor.minimap,
        },
        lineNumbers: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.editor.lineNumbers,
        },
        autoSave: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.editor.autoSave,
        },
        formatOnSave: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.editor.formatOnSave,
        },
      },
      layout: {
        sidebarCollapsed: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.layout.sidebarCollapsed,
        },
        settingsNavCollapsed: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.layout.settingsNavCollapsed,
        },
        editorExplorerCollapsed: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.layout.editorExplorerCollapsed,
        },
        terminalCollapsed: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.layout.terminalCollapsed,
        },
      },
      github: {
        username: {
          type: String,
          default: DEFAULT_USER_SETTINGS.github.username,
          trim: true,
        },
        defaultBranch: {
          type: String,
          default: DEFAULT_USER_SETTINGS.github.defaultBranch,
          trim: true,
        },
        autoSync: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.github.autoSync,
        },
        tokenConfigured: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.github.tokenConfigured,
        },
        tokenLast4: {
          type: String,
          default: DEFAULT_USER_SETTINGS.github.tokenLast4,
        },
      },
      security: {
        twoFactorEnabled: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.security.twoFactorEnabled,
        },
        loginAlerts: {
          type: Boolean,
          default: DEFAULT_USER_SETTINGS.security.loginAlerts,
        },
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes (single source of truth — no duplicate) ──────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

// ── Pre-save: hash password ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// ── Instance Methods ─────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.toSafeObject = function (): SafeUser {
  const savedSettings = (this.settings as unknown as { toObject?: () => Partial<UserSettings> })?.toObject
    ? (this.settings as unknown as { toObject: () => Partial<UserSettings> }).toObject()
    : this.settings;

  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    isEmailVerified: this.isEmailVerified,
    settings: {
      ...DEFAULT_USER_SETTINGS,
      ...(savedSettings ?? {}),
      appearance: {
        ...DEFAULT_USER_SETTINGS.appearance,
        ...(savedSettings?.appearance ?? {}),
      },
      editor: {
        ...DEFAULT_USER_SETTINGS.editor,
        ...(savedSettings?.editor ?? {}),
      },
      layout: {
        ...DEFAULT_USER_SETTINGS.layout,
        ...(savedSettings?.layout ?? {}),
      },
      github: {
        ...DEFAULT_USER_SETTINGS.github,
        ...(savedSettings?.github ?? {}),
      },
      security: {
        ...DEFAULT_USER_SETTINGS.security,
        ...(savedSettings?.security ?? {}),
      },
    },
    createdAt: this.createdAt,
  };
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;

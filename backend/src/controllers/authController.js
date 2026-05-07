import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language || "sl",
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt
  };
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET || "development-secret",
      { expiresIn: "8h" }
    );

    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
}

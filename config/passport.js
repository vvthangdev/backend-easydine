const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.model");
const bcrypt = require("bcrypt");

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user =
            (await User.findOne({ googleId: profile.id })) ||
            (await User.findOne({ email: profile.emails[0].value }));

          if (user) {
            user.googleId = profile.id;
            user.avatar = profile.photos[0].value || user.avatar;
            user.name = profile.displayName || user.name;
            await user.save();
          } else {
            // const randomPassword = Math.random().toString(36).slice(-8);
            // const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const defaultPassword = "12345678"; // Mật khẩu mặc định
            const hashedPassword = await bcrypt.hash(defaultPassword, 10); // Mã hóa mật khẩu

            user = new User({
              googleId: profile.id,
              username: `google_${profile.id}`,
              email: profile.emails[0].value,
              password: hashedPassword,
              name: profile.displayName,
              avatar: profile.photos[0].value,
              role: "CUSTOMER",
            });
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

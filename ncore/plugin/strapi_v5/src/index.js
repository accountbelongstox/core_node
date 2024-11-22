'use strict';

module.exports = {
  register({ strapi }) {
    // Registering a new route
    strapi.server.router.get('/users/me', async (ctx) => {
      const userId = ctx.state.user.id;
      // Fetch user data from the database
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['role'],
      });

      // Add additional fields
      ctx.body = {
        ...user,
        nickname: user.nickname || '',
        diction: user.diction || '',
        avatar: user.avatar || '',
        agreed: user.agreed || '',
      };
    });
  },

  bootstrap(/*{ strapi }*/) {
    // Bootstrap logic here, if necessary
  },

  destroy(/*{ strapi }*/) {
    // Cleanup logic here, if necessary
  },
};

// module.exports = {
//   register(/*{ strapi }*/) {},
//   bootstrap(/*{ strapi }*/) {},
// };
// export default {
//   register({ strapi }) {
//     const extensionService = strapi.plugin('graphql').service('extension');
//     extensionService.use(({ nexus }) => ({
//       types: [
//         nexus.extendType({
//           type: 'UsersPermissionsMe',
//           definition(t) {
//             // Define fields here
//             t.string('nickname');
//             t.string('diction');
//             t.string('avatar');
//             t.string('agreed');
//           },
//         }),
//       ]
//     }));
//   },
//   bootstrap(/*{ strapi }*/) {
//   },
//   destroy(/*{ strapi }*/) {
//   },
// };


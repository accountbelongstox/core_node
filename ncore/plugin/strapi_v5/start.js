const {register} = require('@strapi/strapi');

register({
  strapi,
  async register() {
    const extensionService = strapi.plugins['graphql'].services.extension;

    extensionService.use(({ nexus }) => ({
      types: [
        nexus.extendType({
          type: 'UsersPermissionsMe',
          definition(t) {
            t.string('nickname', {
              resolve: async (root, args, ctx) => {
                // Assuming nickname is a field on the user object
                const user = await strapi.plugins['users-permissions'].services.user.fetch({
                  id: root.id,
                });
                return user.nickname || null;
              },
            });
          },
        }),
      ],
    }));
  },
});


const strapi = require('@strapi/strapi');
strapi(/* {...} */).start();
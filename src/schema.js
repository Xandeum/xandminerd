// schema.js
const { GraphQLObjectType, GraphQLList, GraphQLFloat, GraphQLID, GraphQLSchema } = require('graphql');

const DriveType = new GraphQLObjectType({
  name: 'Drive',
  fields: () => ({
    drive: { type: GraphQLID },
    capacity: { type: GraphQLFloat },
    used: { type: GraphQLFloat },
    free: { type: GraphQLFloat },
  }),
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    drives: {
      type: new GraphQLList(DriveType),
      resolve: () => {
        return [
          {
            drive: "D001",
            capacity: 500,
            used: 78.6,
            free: 421.4,
          },
          {
            drive: "D002",
            capacity: 1024,
            used: 517.64,
            free: 506.36,
          },
        ];
      },
    },
  }),
});

module.exports = new GraphQLSchema({
  query: QueryType,
});


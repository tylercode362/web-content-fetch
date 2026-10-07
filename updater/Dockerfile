# Supply a reviewed immutable Node Alpine base digest. No default/floating base.
ARG UPDATER_BASE_IMAGE
FROM ${UPDATER_BASE_IMAGE}
RUN apk add --no-cache git openssh-client
WORKDIR /app
COPY lib/repository-polling.mjs lib/repository-source.mjs lib/repository-ssh.sh /app/lib/
COPY project-updater.mjs project.json /app/
RUN chmod 0555 /app/lib/repository-ssh.sh && chmod 0444 /app/lib/*.mjs /app/project-updater.mjs /app/project.json
ENTRYPOINT ["node", "/app/project-updater.mjs"]
CMD ["run"]

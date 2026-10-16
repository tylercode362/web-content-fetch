# Supply a reviewed immutable Node Alpine base digest. No default/floating base.
ARG UPDATER_BASE_IMAGE
FROM ${UPDATER_BASE_IMAGE} AS openssh-builder
ARG UPDATER_BASE_IMAGE
RUN node -e 'if (!/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(process.env.UPDATER_BASE_IMAGE || "")) throw new Error("immutable_UPDATER_BASE_IMAGE_required")' \
    && apk add --no-cache build-base openssl-dev zlib-dev ca-certificates curl gnupg
WORKDIR /build
COPY openssh-source.lock.json verify-openssh-release.mjs ./
# Verify all bytes and the pinned full OpenPGP signer before extracting source.
RUN node /build/verify-openssh-release.mjs download /build/materials \
    && tar -xzf /build/materials/openssh-10.6p1.tar.gz -C /build \
    && cd /build/openssh-10.6p1 \
    && ./configure --prefix=/usr --sysconfdir=/etc/ssh \
        --without-pam --without-kerberos5 --without-libedit \
        --without-security-key-builtin \
    && make -j2 ssh ssh-keygen \
    && mkdir /out \
    && install -m 0555 ssh ssh-keygen /out/ \
    && install -m 0444 LICENCE /out/LICENCE

FROM ${UPDATER_BASE_IMAGE} AS runtime
RUN apk add --no-cache git libcrypto3 zlib \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
COPY --from=openssh-builder /out/ssh /out/ssh-keygen /usr/bin/
COPY --from=openssh-builder /out/LICENCE /usr/share/licenses/openssh/LICENCE
COPY openssh-source.lock.json /usr/share/updater/openssh-source.lock.json
RUN /usr/bin/ssh -V 2>&1 | grep '^OpenSSH_10.6p1,' \
    && test -x /usr/bin/ssh-keygen \
    && ! command -v sshd \
    && ! command -v gcc \
    && ! command -v make \
    && ! command -v gpg \
    && ! command -v npm \
    && ! command -v npx \
    && ! command -v yarn
WORKDIR /app
COPY lib/repository-polling.mjs lib/repository-source.mjs lib/repository-ssh.sh /app/lib/
COPY project-updater.mjs project.json /app/
RUN chmod 0555 /app/lib/repository-ssh.sh && chmod 0444 /app/lib/*.mjs /app/project-updater.mjs /app/project.json
ENTRYPOINT ["node", "/app/project-updater.mjs"]
CMD ["run"]

-- CreateTable
CREATE TABLE "elogios_motoristas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeMotorista" TEXT,
    "carreta" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "elogio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapsLink" TEXT,
    "userAgent" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "tokenAvaliador" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elogios_motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elogios_internos" (
    "id" SERIAL NOT NULL,
    "matricula" TEXT NOT NULL,
    "elogio" TEXT NOT NULL,
    "motorista" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapsLink" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenAvaliador" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,

    CONSTRAINT "elogios_internos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencias_motoristas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "carreta" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "tipoOcorrencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapsLink" TEXT,
    "userAgent" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencias_motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "elogios_motoristas_carreta_tokenAvaliador_dataHora_idx" ON "elogios_motoristas"("carreta", "tokenAvaliador", "dataHora");

-- CreateIndex
CREATE INDEX "elogios_internos_matricula_tokenAvaliador_dataHora_idx" ON "elogios_internos"("matricula", "tokenAvaliador", "dataHora");

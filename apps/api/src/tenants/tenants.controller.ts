import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@UseGuards(ApiTokenGuard)
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto.name, dto.plan_tier);
  }

  @Get()
  findAll() {
    return this.tenants.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenants.findOneOrFail(id);
  }
}

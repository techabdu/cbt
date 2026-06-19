<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CollegeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'logo_path'     => $this->logo_path,
            'contact_email' => $this->contact_email,
            'contact_phone' => $this->contact_phone,
            'address'       => $this->address,
        ];
    }
}
